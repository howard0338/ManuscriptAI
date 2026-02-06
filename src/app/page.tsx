"use client";

import { useState, useEffect } from "react";
import { PenLine } from "lucide-react";
import ProgressNav from "@/components/ProgressNav";
import Step1StyleDiscussion, {
  type ManuscriptData,
} from "@/components/Step1StyleDiscussion";
import Step2Introduction from "@/components/Step2Introduction";

const STORAGE_KEY_DATA = "manuscript-architect-data";
const STORAGE_KEY_TITLE = "manuscript-architect-title";

const INITIAL_MANUSCRIPT_DATA: ManuscriptData = {
  field: null,
  journalStyle: null,
  optionalAbstract: "",
  rag_sources: [],
};

function loadManuscriptData(): ManuscriptData {
  if (typeof window === "undefined") return INITIAL_MANUSCRIPT_DATA;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DATA);
    if (!raw) return INITIAL_MANUSCRIPT_DATA;
    const parsed = JSON.parse(raw) as ManuscriptData;
    return {
      ...INITIAL_MANUSCRIPT_DATA,
      ...parsed,
      rag_sources: Array.isArray(parsed.rag_sources) ? parsed.rag_sources : [],
      introductionParagraphs: Array.isArray(parsed.introductionParagraphs)
        ? parsed.introductionParagraphs
        : undefined,
      introductionSources: Array.isArray(parsed.introductionSources)
        ? parsed.introductionSources
        : undefined,
    };
  } catch {
    return INITIAL_MANUSCRIPT_DATA;
  }
}

function loadTitleInput(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY_TITLE) ?? "";
}

export default function ManuscriptArchitectPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [manuscriptTitle, setManuscriptTitle] = useState("");
  const [introductionParagraphs, setIntroductionParagraphs] = useState<
    string[] | null
  >(null);
  const [introductionSources, setIntroductionSources] = useState<
    Array<{ source_id: string; title?: string; author?: string; excerpt: string }> | null
  >(null);

  const [manuscriptData, setManuscriptData] = useState<ManuscriptData>(
    INITIAL_MANUSCRIPT_DATA
  );
  const [titleInput, setTitleInput] = useState("");

  useEffect(() => {
    const loaded = loadManuscriptData();
    setManuscriptData(loaded);
    setIntroductionParagraphs(loaded.introductionParagraphs ?? null);
    setIntroductionSources(loaded.introductionSources ?? null);
    setTitleInput(loadTitleInput());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(manuscriptData));
    } catch {}
  }, [manuscriptData]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TITLE, titleInput);
    } catch {}
  }, [titleInput]);

  const handleConfirmTitle = (
    title: string,
    paragraphs?: string[],
    sources?: Array<{ source_id: string; title?: string; author?: string; excerpt: string }>
  ) => {
    setManuscriptTitle(title);
    setIntroductionParagraphs(paragraphs ?? null);
    setIntroductionSources(sources ?? null);
    setManuscriptData((prev) => ({
      ...prev,
      introductionParagraphs: paragraphs ?? [],
      introductionSources: sources ?? [],
    }));
    setCurrentStep(2);
  };

  const handleIntroductionChange = (paragraphs: string[]) => {
    setIntroductionParagraphs(paragraphs.length > 0 ? paragraphs : null);
    setManuscriptData((prev) => ({ ...prev, introductionParagraphs: paragraphs }));
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-[#f8fafc] text-slate-900"
      style={{ background: "#f8fafc" }}
    >
      {/* Top: Deep blue nav bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-indigo-900/20 bg-[#1e3a5f] px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <PenLine className="h-6 w-6 text-white" />
          <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
            Manuscript Architect AI
          </h1>
        </div>
        <ProgressNav
          currentStep={currentStep}
          onStepClick={(step) => setCurrentStep(step)}
        />
      </header>

      {/* Content: Step 1 full-width Gemini layout; other steps use wide container */}
      <main className="flex flex-1 flex-col min-h-0">
        {currentStep === 1 ? (
          <Step1StyleDiscussion
            manuscriptData={manuscriptData}
            onManuscriptDataChange={setManuscriptData}
            titleInput={titleInput}
            onTitleInputChange={setTitleInput}
            onConfirmTitle={handleConfirmTitle}
          />
        ) : (
          <div className="flex-1 overflow-auto">
            <div className="max-w-5xl px-4 py-8 ml-0 mr-auto">
          {currentStep === 2 && (
            <>
              {manuscriptTitle && (
                <p className="mb-6 text-sm text-slate-600">
                  Title: <span className="font-medium text-slate-800">{manuscriptTitle}</span>
                </p>
              )}
              <Step2Introduction
                key={manuscriptTitle}
                initialParagraphs={introductionParagraphs}
                initialSources={introductionSources}
                ragSources={manuscriptData.rag_sources ?? []}
                onIntroductionChange={handleIntroductionChange}
              />
            </>
          )}

          {currentStep === 3 && (
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="mb-2 text-lg font-semibold text-slate-800">
                Materials & Methods
              </h2>
              <p className="text-sm text-slate-600">
                Image upload and Origin data parsing will be supported later.
              </p>
            </div>
          )}

          {currentStep === 4 && (
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="mb-2 text-lg font-semibold text-slate-800">
                Results
              </h2>
              <p className="text-sm text-slate-600">
                Image upload and Origin data parsing will be supported later.
              </p>
            </div>
          )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
