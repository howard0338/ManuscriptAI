"use client";

import React, { useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import {
  renderParagraphWithCitations,
  type SourceDetail,
  type CitationClickHandler,
  type SourceClickHandler,
} from "./CitationPopover";

export type SentenceCardProps = {
  id: string;
  index: number;
  text: string;
  sources: SourceDetail[] | null;
  isEditing: boolean;
  onStartEdit: () => void;
  onBlur: (value: string) => void;
  onCitationClick: CitationClickHandler;
  onSourceClick: SourceClickHandler;
  onPortClick: (sentence: string, e: React.MouseEvent) => void;
};

export function SentenceCard({
  id,
  index,
  text,
  sources,
  isEditing,
  onStartEdit,
  onBlur,
  onCitationClick,
  onSourceClick,
  onPortClick,
}: SentenceCardProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(text.length, text.length);
    }
  }, [isEditing, text.length]);

  const hasCitations = /\[\d+\]|\[\[[^\]]+\]\]/.test(text);

  return (
    <div
        ref={setNodeRef}
        style={style}
        className={`relative flex min-h-[52px] w-full items-stretch rounded-lg border bg-white shadow-sm transition-shadow ${
          isDragging
            ? "z-50 border-indigo-300 shadow-lg opacity-95"
            : "border-slate-200 hover:border-slate-300 hover:shadow"
        }`}
      >
        {/* Drag handle (left) */}
        <div
          {...attributes}
          {...listeners}
          className="flex shrink-0 cursor-grab active:cursor-grabbing items-center justify-center rounded-l-lg border-r border-slate-200 bg-slate-50 px-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Sentence content (click to edit) */}
        <div
          className="min-w-0 flex-1 py-2 pl-3 pr-2"
          onClick={!isEditing ? onStartEdit : undefined}
        >
          {isEditing ? (
            <textarea
              ref={inputRef}
              defaultValue={text}
              onBlur={(e) => onBlur(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  (e.target as HTMLTextAreaElement).blur();
                }
              }}
              className="min-h-[36px] w-full resize-none rounded border border-indigo-200 bg-indigo-50/30 p-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          ) : (
            <p className="text-sm leading-relaxed text-slate-700">
              {renderParagraphWithCitations(text, onCitationClick, {
                sources: sources ?? undefined,
                onSourceClick,
              })}
            </p>
          )}
        </div>

        {/* Port: dot on the right, click to show RAG sources for this sentence */}
        <div className="flex shrink-0 items-center pr-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPortClick(text, e);
            }}
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
              hasCitations
                ? "border-indigo-300 bg-indigo-100 text-indigo-600 hover:bg-indigo-200"
                : "border-slate-200 bg-slate-100 text-slate-400 hover:bg-slate-200"
            }`}
            title="View citations and RAG sources"
          >
            <span className="text-[10px] font-medium">
              {hasCitations ? "1" : "·"}
            </span>
          </button>
        </div>
    </div>
  );
}

/**
 * Get the first citation (source or ref) from a sentence for the verification popover when Port is clicked.
 */
export function getFirstCitationFromSentence(
  sentence: string,
  sources: SourceDetail[] | null
): { type: "source"; source: SourceDetail } | { type: "ref"; refNum: number } | null {
  const sourceMatch = sentence.match(/\[\[([^\]]+)\]\]/);
  if (sourceMatch && sources) {
    const src = sources.find((s) => s.source_id === sourceMatch[1]);
    if (src) return { type: "source", source: src };
  }
  const refMatch = sentence.match(/\[(\d+)\]/);
  if (refMatch) return { type: "ref", refNum: parseInt(refMatch[1], 10) };
  return null;
}
