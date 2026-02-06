"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Send, Loader2, BookOpen, Target, FileText, Plus, Link, FileUp, X } from "lucide-react";

const STORAGE_KEY_GUIDE = "manuscript-architect-step1-guide-messages";

// Field options (stored in manuscriptData.field)
export const FIELD_OPTIONS = [
  { id: "polymer", label: "Polymer" },
  { id: "biomed", label: "Biomedical materials" },
  { id: "neuro", label: "Neuro engineering" },
  { id: "semiconductor", label: "Semiconductor" },
  { id: "other", label: "Other" },
] as const;

export const JOURNAL_OPTIONS = [
  { id: "high-impact", label: "High Impact (IF > 15)", desc: "Breakthrough and broad impact" },
  { id: "specialized", label: "Specialized (IF 5-10)", desc: "Technical depth and field contribution" },
  { id: "letter", label: "Letter / Brief", desc: "Short communications and experimental data" },
] as const;

const FIELD_TO_RAG_LABEL: Record<string, string> = {
  polymer: "Polymer-enhanced retrieval",
  biomed: "Biomedical materials database",
  neuro: "Neuro engineering literature",
  semiconductor: "Semiconductor retrieval",
  other: "General literature",
};

export type RagSourceItem = { id: string; type: "pdf" | "url"; name: string };

export type IntroductionSource = {
  source_id: string;
  title?: string;
  author?: string;
  excerpt: string;
};

export type ManuscriptData = {
  field: string | null;
  journalStyle: string | null;
  optionalAbstract: string;
  rag_sources: RagSourceItem[];
  introductionParagraphs?: string[];
  introductionSources?: IntroductionSource[];
};

export function getRagContextFromField(field: string | null): string | null {
  if (!field) return null;
  const labels: Record<string, string> = {
    polymer: "Polymer Science RAG",
    biomed: "Bio-Med Database",
    neuro: "Neuroscience & Engineering RAG",
    semiconductor: "Semiconductor RAG",
    other: "Nature Style Guide",
  };
  return labels[field] ?? null;
}

type GuideMessage = { role: "user" | "assistant"; content: string };

const WELCOME_MESSAGE: GuideMessage = {
  role: "assistant",
  content: "Select your research field and target journal in the left panel, and optionally add project RAG sources. When ready, enter your manuscript title below and send to generate the Introduction.",
};

function loadGuideMessages(): GuideMessage[] {
  if (typeof window === "undefined") return [WELCOME_MESSAGE];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GUIDE);
    if (!raw) return [WELCOME_MESSAGE];
    const parsed = JSON.parse(raw) as GuideMessage[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [WELCOME_MESSAGE];
  } catch {
    return [WELCOME_MESSAGE];
  }
}

function saveGuideMessages(messages: GuideMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY_GUIDE, JSON.stringify(messages));
  } catch {}
}

export default function Step1StyleDiscussion({
  manuscriptData,
  onManuscriptDataChange,
  titleInput,
  onTitleInputChange,
  onConfirmTitle,
}: {
  manuscriptData: ManuscriptData;
  onManuscriptDataChange: (data: ManuscriptData | ((prev: ManuscriptData) => ManuscriptData)) => void;
  titleInput: string;
  onTitleInputChange: (value: string) => void;
  onConfirmTitle: (
    title: string,
    introductionParagraphs?: string[],
    sources?: Array<{ source_id: string; title?: string; author?: string; excerpt: string }>
  ) => void;
}) {
  const [introLoading, setIntroLoading] = useState(false);
  const [showAddRag, setShowAddRag] = useState(false);
  const [addRagType, setAddRagType] = useState<"pdf" | "url">("url");
  const [addRagInput, setAddRagInput] = useState("");
  const [guideMessages, setGuideMessages] = useState<GuideMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { field, journalStyle, optionalAbstract, rag_sources } = manuscriptData;
  const ragDisplayName = field ? FIELD_TO_RAG_LABEL[field] ?? "Field RAG" : null;
  const ragLabel = getRagContextFromField(field);

  useEffect(() => {
    setGuideMessages(loadGuideMessages());
  }, []);

  useEffect(() => {
    saveGuideMessages(guideMessages);
  }, [guideMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [guideMessages]);

  const updateData = useCallback(
    (patch: Partial<ManuscriptData>, guideText?: string) => {
      onManuscriptDataChange((prev) => ({ ...prev, ...patch }));
      if (guideText) {
        setGuideMessages((prev) => [...prev, { role: "assistant", content: guideText }]);
      }
    },
    [onManuscriptDataChange]
  );

  const handleSubmitTitle = useCallback(async () => {
    const trimmed = titleInput.trim();
    if (!trimmed || introLoading) return;
    setIntroLoading(true);
    try {
      const res = await fetch("/api/introduction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmed,
          ragContext: ragLabel,
          rag_sources: manuscriptData.rag_sources,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Introduction request failed");
      const paragraphs = data.paragraphs ?? [];
      const sources = Array.isArray(data.sources) ? data.sources : undefined;
      onConfirmTitle(trimmed, Array.isArray(paragraphs) ? paragraphs : [], sources);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Generation failed. Please try again.";
      onConfirmTitle(trimmed);
    } finally {
      setIntroLoading(false);
    }
  }, [titleInput, introLoading, ragLabel, manuscriptData.rag_sources, onConfirmTitle]);

  const handleFieldSelect = useCallback(
    (id: string) => {
      const next = field === id ? null : id;
      const label = next ? FIELD_OPTIONS.find((o) => o.id === id)?.label ?? id : null;
      updateData(
        { field: next },
        label ? `Switched to ${label} RAG. Writing will use this field for retrieval.` : "Field selection cleared."
      );
    },
    [field, updateData]
  );

  const handleJournalSelect = useCallback(
    (id: string) => {
      const next = journalStyle === id ? null : id;
      const opt = next ? JOURNAL_OPTIONS.find((o) => o.id === id) : null;
      updateData(
        { journalStyle: next },
        opt ? `Target journal set: ${opt.label}.` : "Journal setting cleared."
      );
    },
    [journalStyle, updateData]
  );

  const handleAddRagSource = useCallback(() => {
    const name = addRagInput.trim();
    if (!name) return;
    const id = `rag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    updateData(
      { rag_sources: [...rag_sources, { id, type: addRagType, name }] },
      `RAG source added: ${name} (${addRagType === "pdf" ? "PDF" : "link"}).`
    );
    setAddRagInput("");
    setShowAddRag(false);
  }, [addRagInput, addRagType, rag_sources, updateData]);

  const handleRemoveRagSource = useCallback(
    (id: string) => {
      const name = rag_sources.find((s) => s.id === id)?.name ?? "";
      updateData(
        { rag_sources: rag_sources.filter((s) => s.id !== id) },
        name ? `RAG source removed: ${name}.` : undefined
      );
    },
    [rag_sources, updateData]
  );

  return (
    <div className="flex h-full min-h-0 w-full">
      {/* Left sidebar */}
      <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-gray-50 overflow-y-auto">
        <div className="p-4 space-y-6">
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <BookOpen className="h-4 w-4 text-indigo-600" />
              Research field
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {FIELD_OPTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleFieldSelect(id)}
                  className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    field === id
                      ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <Target className="h-4 w-4 text-indigo-600" />
              Target journal tier
            </h3>
            <div className="space-y-1.5">
              {JOURNAL_OPTIONS.map(({ id, label, desc }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleJournalSelect(id)}
                  className={`w-full rounded-lg border p-2.5 text-left text-xs transition-colors ${
                    journalStyle === id
                      ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span className="font-medium">{label}</span>
                  <span className="mt-0.5 block text-slate-500">{desc}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <FileUp className="h-4 w-4 text-indigo-600" />
              Project RAG sources
            </h3>
            <p className="mb-2 text-xs text-slate-500">
              Scoped retrieval (Intro / Methods / Results)
            </p>
            <ul className="mb-2 space-y-1">
              {rag_sources.length === 0 ? (
                <li className="rounded border border-dashed border-slate-200 bg-white/80 py-2 text-center text-xs text-slate-400">
                  No sources yet
                </li>
              ) : (
                rag_sources.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1.5 text-xs"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      {s.type === "pdf" ? <FileUp className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : <Link className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                      <span className="truncate text-slate-700">{s.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRagSource(s.id)}
                      className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      aria-label="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))
              )}
            </ul>
            {!showAddRag ? (
              <button
                type="button"
                onClick={() => setShowAddRag(true)}
                className="flex w-full items-center justify-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
              >
                <Plus className="h-3.5 w-3.5" /> Add RAG source
              </button>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white p-2">
                <div className="mb-1.5 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setAddRagType("pdf")}
                    className={`rounded px-1.5 py-0.5 text-xs ${addRagType === "pdf" ? "bg-indigo-100 text-indigo-800" : "text-slate-500"}`}
                  >
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddRagType("url")}
                    className={`rounded px-1.5 py-0.5 text-xs ${addRagType === "url" ? "bg-indigo-100 text-indigo-800" : "text-slate-500"}`}
                  >
                    Link
                  </button>
                </div>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={addRagInput}
                    onChange={(e) => setAddRagInput(e.target.value)}
                    placeholder={addRagType === "pdf" ? "Filename" : "URL"}
                    className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddRagSource}
                    disabled={!addRagInput.trim()}
                    className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700 disabled:bg-slate-300"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddRag(false); setAddRagInput(""); }}
                    className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-1.5 text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-indigo-600" />
              Reference abstract (Optional)
            </h3>
            <textarea
              value={optionalAbstract}
              onChange={(e) => updateData({ optionalAbstract: e.target.value })}
              placeholder="Paste literature abstract…"
              rows={2}
              className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
            />
          </section>
        </div>
      </aside>

      {/* Main area: conversation + bottom input */}
      <div className="flex flex-1 flex-col min-h-0 bg-white">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 py-6">
            {guideMessages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-3 py-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
              >
                {m.role === "assistant" && (
                  <div className="h-8 w-8 shrink-0 rounded-full bg-slate-200 flex items-center justify-center">
                    <span className="text-xs font-medium text-slate-600">AI</span>
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {m.content}
                </div>
                {m.role === "user" && (
                  <div className="h-8 w-8 shrink-0 rounded-full bg-indigo-100 flex items-center justify-center">
                    <span className="text-xs font-medium text-indigo-700">You</span>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Bottom input (Gemini style) */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <span className="shrink-0 text-xs text-slate-500 whitespace-nowrap">
              Title: {titleInput.trim() || "Not set"}
            </span>
            <input
              type="text"
              value={titleInput}
              onChange={(e) => onTitleInputChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmitTitle()}
              placeholder="Enter manuscript title and press Enter or Send"
              className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              disabled={introLoading}
            />
            <button
              type="button"
              onClick={handleSubmitTitle}
              disabled={!titleInput.trim() || introLoading}
              className="shrink-0 flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500"
              title="Confirm and go to Introduction"
            >
              {introLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
