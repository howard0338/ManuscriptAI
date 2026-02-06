"use client";

import { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import {
  CitationPopover,
  extractSentenceContainingCitation,
  type SourceDetail,
} from "./CitationPopover";
import { SentenceCard, getFirstCitationFromSentence } from "./SentenceCard";
import { paragraphsToSentences, sentencesToParagraphs } from "@/lib/sentences";
import type { RagSourceItem } from "./Step1StyleDiscussion";
import { FileUp, Link, Loader2 } from "lucide-react";

const PLACEHOLDER_PARAGRAPHS = [
  "Polymer-based nanomaterials have attracted significant attention in recent years due to their tunable properties and broad applications in biomedicine and catalysis [1]. The ability to control molecular weight and architecture enables precise tailoring of mechanical and thermal behavior [2].",
  "Recent advances in controlled radical polymerization have expanded the toolkit available to synthetic chemists [1]. Techniques such as ATRP and RAFT allow for the preparation of well-defined block copolymers with narrow dispersity [2].",
  "Characterization of polymer nanostructures typically relies on scattering techniques and microscopy [1]. Small-angle X-ray scattering (SAXS) provides insights into morphology at length scales from nanometers to hundreds of nanometers [2].",
  "In this work, we report a new class of stimuli-responsive polymers that exhibit reversible phase transitions in aqueous solution [1]. Our approach combines computational design with high-throughput screening to identify optimal compositions [2].",
];

type CitationState =
  | { type: "ref"; refNum: number; x: number; y: number; aiSentence: string }
  | { type: "source"; source: SourceDetail; x: number; y: number; aiSentence: string }
  | null;

function ConnectorLine() {
  return (
    <div
      className="flex flex-col items-center py-0.5"
      style={{ pointerEvents: "none" }}
      aria-hidden
    >
      <div className="h-2 w-px bg-slate-200" />
      <svg className="h-3 w-3 shrink-0 text-slate-300" viewBox="0 0 12 12" fill="currentColor">
        <path d="M6 9L2 5h8L6 9z" />
      </svg>
    </div>
  );
}

function DroppableGapCircle({
  id,
  index,
  isOver,
  isGenerating,
}: {
  id: string;
  index: number;
  isOver: boolean;
  isGenerating: boolean;
}) {
  const { setNodeRef, isOver: isOverDroppable } = useDroppable({
    id,
    data: { type: "sentence-gap" as const, index },
  });
  const over = isOver || isOverDroppable;
  return (
    <div
      ref={setNodeRef}
      className="flex flex-col items-center py-1"
      data-drop-index={index}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-dashed transition-colors ${
          over ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-slate-50/80"
        } ${isGenerating ? "pointer-events-none" : ""}`}
        title="Drop a RAG source here to generate a sentence"
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
        ) : (
          <span className="text-xs text-slate-400">+</span>
        )}
      </div>
    </div>
  );
}

function DraggableRagSource({ source }: { source: RagSourceItem }) {
  const id = `rag-${source.id}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { type: "rag-source" as const, sourceId: source.id, sourceName: source.name },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex cursor-grab active:cursor-grabbing items-center gap-2 rounded-lg border bg-white px-2.5 py-1.5 text-xs shadow-sm transition-shadow hover:shadow ${
        isDragging ? "opacity-60 shadow-md" : "border-slate-200"
      }`}
    >
      {source.type === "pdf" ? (
        <FileUp className="h-3.5 w-3.5 shrink-0 text-slate-500" />
      ) : (
        <Link className="h-3.5 w-3.5 shrink-0 text-slate-500" />
      )}
      <span className="truncate text-slate-700">{source.name}</span>
    </div>
  );
}

export default function Step2Introduction({
  initialParagraphs = null,
  initialSources = null,
  ragSources = [],
  onIntroductionChange,
}: {
  initialParagraphs?: string[] | null;
  initialSources?: SourceDetail[] | null;
  /** User-added RAG sources (PDF/link) shown on the right; drag to empty circle to generate a sentence */
  ragSources?: RagSourceItem[];
  /** When sentences change, pass back paragraphs (compatible with introductionParagraphs) for parent to persist to manuscriptData / localStorage */
  onIntroductionChange?: (paragraphs: string[]) => void;
}) {
  const initialSentences = useMemo(
    () =>
      initialParagraphs && initialParagraphs.length > 0
        ? paragraphsToSentences(initialParagraphs)
        : paragraphsToSentences(PLACEHOLDER_PARAGRAPHS),
    [initialParagraphs]
  );

  const [sentences, setSentences] = useState<string[]>(initialSentences);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [citationPopover, setCitationPopover] = useState<CitationState>(null);
  const [generatingGapIndex, setGeneratingGapIndex] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const notifyChange = useCallback(
    (newSentences: string[]) => {
      onIntroductionChange?.(sentencesToParagraphs(newSentences));
    },
    [onIntroductionChange]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (over == null) return;

      const activeData = active.data.current;
      const overData = over.data.current;

      if (activeData?.type === "rag-source" && overData?.type === "sentence-gap") {
        const gapIndex = overData.index as number;
        const sourceId = activeData.sourceId as string;
        const sourceName = activeData.sourceName as string;
        setGeneratingGapIndex(gapIndex);
        try {
          const contextBefore = gapIndex > 0 ? sentences[gapIndex - 1] : "";
          const contextAfter = gapIndex < sentences.length ? sentences[gapIndex] : "";
          const res = await fetch("/api/introduction/generate-sentence", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceId,
              sourceName,
              contextBefore,
              contextAfter,
              rag_sources: ragSources,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Failed to generate sentence");
          const newSentence = (data.sentence ?? "").trim();
          if (newSentence) {
            const next = [...sentences];
            next.splice(gapIndex, 0, newSentence);
            setSentences(next);
            notifyChange(next);
          }
        } catch (e) {
          console.error("Generate sentence:", e);
        } finally {
          setGeneratingGapIndex(null);
        }
        return;
      }

      if (active.id === over.id) return;
      const oldIndex = sentences.findIndex((_, i) => `sent-${i}` === active.id);
      const newIndex = sentences.findIndex((_, i) => `sent-${i}` === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const next = arrayMove(sentences, oldIndex, newIndex);
      setSentences(next);
      notifyChange(next);
    },
    [sentences, notifyChange, ragSources]
  );

  const handleStartEdit = useCallback((index: number) => {
    setEditingIndex(index);
  }, []);

  const handleBlur = useCallback(
    (index: number, value: string) => {
      const trimmed = value.trim();
      setSentences((prev) => {
        const next = [...prev];
        next[index] = trimmed || prev[index];
        notifyChange(next);
        return next;
      });
      setEditingIndex(null);
    },
    [notifyChange]
  );

  const handleCitationClick = useCallback(
    (
      refNum: number,
      e: React.MouseEvent,
      paragraphText?: string,
      citationStartIndex?: number,
      citationLength?: number
    ) => {
      e.preventDefault();
      e.stopPropagation();
      const aiSentence =
        paragraphText != null &&
        citationStartIndex != null &&
        citationLength != null
          ? extractSentenceContainingCitation(paragraphText, citationStartIndex, citationLength)
          : paragraphText ?? "";
      setCitationPopover({
        type: "ref",
        refNum,
        x: e.clientX,
        y: e.clientY + 12,
        aiSentence,
      });
    },
    []
  );

  const handleSourceClick = useCallback(
    (
      sourceId: string,
      e: React.MouseEvent,
      paragraphText?: string,
      citationStartIndex?: number,
      citationLength?: number
    ) => {
      e.preventDefault();
      e.stopPropagation();
      const source = initialSources?.find((s) => s.source_id === sourceId);
      if (source) {
        const aiSentence =
          paragraphText != null &&
          citationStartIndex != null &&
          citationLength != null
            ? extractSentenceContainingCitation(paragraphText, citationStartIndex, citationLength)
            : paragraphText ?? "";
        setCitationPopover({
          type: "source",
          source,
          x: e.clientX,
          y: e.clientY + 12,
          aiSentence,
        });
      }
    },
    [initialSources]
  );

  const handlePortClick = useCallback(
    (sentence: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const first = getFirstCitationFromSentence(sentence, initialSources ?? null);
      if (first) {
        if (first.type === "source") {
          setCitationPopover({
            type: "source",
            source: first.source,
            x: e.clientX,
            y: e.clientY + 12,
            aiSentence: sentence,
          });
        } else {
          setCitationPopover({
            type: "ref",
            refNum: first.refNum,
            x: e.clientX,
            y: e.clientY + 12,
            aiSentence: sentence,
          });
        }
      }
    },
    [initialSources]
  );

  const sortableIds = useMemo(
    () => sentences.map((_, i) => `sent-${i}`),
    [sentences.length]
  );

  return (
    <div className="flex w-full gap-8">
      <div className="flex flex-col gap-6 max-w-2xl w-full min-w-0">
        <h2 className="text-lg font-semibold text-slate-800">Introduction</h2>
        <p className="text-xs text-slate-500">
          Drag to reorder sentences; click to edit; use the dot on the right to view RAG sources. Drag a source from the right into an empty circle to generate a sentence from that literature.
        </p>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col">
              {sentences.map((text, index) => (
                <div key={`sent-${index}`} className="relative">
                  {index > 0 && <ConnectorLine />}
                  <DroppableGapCircle
                    id={`gap-${index}`}
                    index={index}
                    isOver={false}
                    isGenerating={generatingGapIndex === index}
                  />
                  <SentenceCard
                    id={`sent-${index}`}
                    index={index}
                    text={text}
                    sources={initialSources ?? null}
                    isEditing={editingIndex === index}
                    onStartEdit={() => handleStartEdit(index)}
                    onBlur={(value) => handleBlur(index, value)}
                    onCitationClick={handleCitationClick}
                    onSourceClick={handleSourceClick}
                    onPortClick={handlePortClick}
                  />
                </div>
              ))}
              <DroppableGapCircle
                id={`gap-${sentences.length}`}
                index={sentences.length}
                isOver={false}
                isGenerating={generatingGapIndex === sentences.length}
              />
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <aside className="w-56 shrink-0">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Your RAG sources</h3>
        <p className="mb-3 text-xs text-slate-500">
          Drag a source to an empty circle in the list to generate one sentence from that literature (fits context).
        </p>
        <div className="flex flex-col gap-2">
          {ragSources.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-4 text-center text-xs text-slate-400">
              No sources yet. Add PDFs or links in Step 1.
            </p>
          ) : (
            ragSources.map((source) => (
              <DraggableRagSource key={source.id} source={source} />
            ))
          )}
        </div>
      </aside>

      {citationPopover && (
        <CitationPopover
          refNum={citationPopover.type === "ref" ? citationPopover.refNum : undefined}
          source={citationPopover.type === "source" ? citationPopover.source : undefined}
          aiSentence={citationPopover.aiSentence}
          onClose={() => setCitationPopover(null)}
          anchor={{ x: citationPopover.x, y: citationPopover.y }}
        />
      )}
    </div>
  );
}
