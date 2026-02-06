"use client";

import React, { useRef, useEffect } from "react";

export type SourceDetail = {
  source_id: string;
  title?: string;
  author?: string;
  excerpt: string;
};

/**
 * Extract the sentence containing the citation position for comparison with RAG excerpt.
 */
export function extractSentenceContainingCitation(
  paragraphText: string,
  citationStartIndex: number,
  citationLength: number
): string {
  if (citationStartIndex < 0 || citationStartIndex + citationLength > paragraphText.length) {
    return paragraphText;
  }
  let start = 0;
  for (let i = citationStartIndex - 1; i >= 0; i--) {
    const c = paragraphText[i];
    if (/[.!?]/.test(c) || c === "\n") {
      start = i + 1;
      break;
    }
    if (i === 0) start = 0;
  }
  let end = paragraphText.length;
  for (let i = citationStartIndex + citationLength; i <= paragraphText.length; i++) {
    if (i === paragraphText.length) {
      end = paragraphText.length;
      break;
    }
    const c = paragraphText[i];
    if (/[.!?]/.test(c) || c === "\n") {
      end = i + 1;
      break;
    }
  }
  return paragraphText.slice(start, end).trim();
}

const SAMPLE_SOURCES: Record<number, string> = {
  1: "Source: Nature 2024, 582, 123-128.",
  2: "Source: Science 2023, 381, 456-461.",
  3: "Source: Nature Materials 2024, 23, 89-95.",
};

export function CitationPopover({
  refNum,
  source,
  aiSentence,
  onClose,
  anchor,
}: {
  refNum?: number;
  source?: SourceDetail;
  /** AI-generated sentence containing this citation (left side of verification view) */
  aiSentence?: string;
  onClose: () => void;
  anchor: { x: number; y: number };
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const rightContent = source ? (
    <div className="space-y-1">
      {source.title && <div className="font-medium text-slate-800">{source.title}</div>}
      {source.author && <div className="text-xs text-slate-600">{source.author}</div>}
      <div className="text-xs text-slate-600 border-t border-slate-100 pt-1 mt-1">
        {source.excerpt}
      </div>
    </div>
  ) : (
    (refNum != null ? SAMPLE_SOURCES[refNum] : null) ?? "Source"
  );

  const showVerification = aiSentence != null && aiSentence.length > 0;
  const content = showVerification ? (
    <div className="flex gap-4 min-w-[420px] max-w-[560px]">
      <div className="flex-1 min-w-0 rounded border border-indigo-100 bg-indigo-50/50 p-2.5">
        <div className="text-xs font-medium text-indigo-700 mb-1">AI-generated sentence</div>
        <p className="text-sm text-slate-800 leading-relaxed">{aiSentence}</p>
      </div>
      <div className="flex-1 min-w-0 rounded border border-slate-200 bg-slate-50/50 p-2.5">
        <div className="text-xs font-medium text-slate-600 mb-1">RAG library excerpt</div>
        <div className="text-sm text-slate-700 leading-relaxed">{rightContent}</div>
      </div>
    </div>
  ) : (
    rightContent
  );

  return (
    <div
      ref={ref}
      className="fixed z-50 rounded-lg border border-slate-200 bg-white/95 px-3 py-2.5 text-slate-700 shadow-lg backdrop-blur"
      style={{ left: anchor.x, top: anchor.y }}
    >
      {content}
    </div>
  );
}

export type CitationClickHandler = (
  refNum: number,
  e: React.MouseEvent,
  paragraphText?: string,
  citationStartIndex?: number,
  citationLength?: number
) => void;
export type SourceClickHandler = (
  sourceId: string,
  e: React.MouseEvent,
  paragraphText?: string,
  citationStartIndex?: number,
  citationLength?: number
) => void;

/**
 * Render paragraph text with [1], [2] and [[source_id]] as clickable citations.
 * When sources exist, [[source_id]] uses onSourceClick and shows the corresponding source in the popover.
 */
export function renderParagraphWithCitations(
  text: string,
  onCitationClick: CitationClickHandler,
  options?: {
    sources?: SourceDetail[];
    onSourceClick?: SourceClickHandler;
  }
): React.ReactNode {
  const parts: (string | React.ReactElement)[] = [];
  const sourcesMap = new Map<string, SourceDetail>();
  options?.sources?.forEach((s) => sourcesMap.set(s.source_id, s));
  const onSourceClick = options?.onSourceClick;

  const combinedRegex = /\[(\d+)\]|\[\[([^\]]+)\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const matchLen = (m: RegExpExecArray) => m[0].length;
  while ((match = combinedRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1] != null) {
      const num = parseInt(match[1], 10);
      parts.push(
        <button
          key={`ref-${match.index}-${num}`}
          type="button"
          onClick={(e) => onCitationClick(num, e, text, match!.index, matchLen(match!))}
          className="cursor-pointer text-indigo-600 underline decoration-indigo-400 hover:text-indigo-800"
        >
          [{num}]
        </button>
      );
    } else if (match[2] != null && onSourceClick) {
      const sourceId = match[2];
      parts.push(
        <button
          key={`src-${match.index}-${sourceId}`}
          type="button"
          onClick={(e) => onSourceClick(sourceId, e, text, match!.index, matchLen(match!))}
          className="cursor-pointer text-indigo-600 underline decoration-indigo-400 hover:text-indigo-800"
        >
          [[{sourceId}]]
        </button>
      );
    } else if (match[2] != null) {
      parts.push(<span key={`plain-${match.index}`}>[[{match[2]}]]</span>);
    }
    lastIndex = combinedRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length ? parts : text;
}
