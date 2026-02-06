"use client";

import { Layers, FileText, FlaskConical, BarChart3 } from "lucide-react";

const STEPS = [
  { id: 1, label: "Structure", icon: Layers },
  { id: 2, label: "Introduction", icon: FileText },
  { id: 3, label: "Materials & Methods", icon: FlaskConical },
  { id: 4, label: "Results", icon: BarChart3 },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export default function ProgressNav({
  currentStep,
  onStepClick,
}: {
  currentStep: number;
  onStepClick?: (step: number) => void;
}) {
  return (
    <nav className="flex items-center gap-2">
      {STEPS.map(({ id, label, icon: Icon }, i) => {
        const isActive = currentStep === id;
        const isPast = currentStep > id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onStepClick?.(id)}
            className={`
              flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors
              ${isActive ? "bg-white/20 text-white" : ""}
              ${isPast ? "text-white/90 hover:bg-white/10" : ""}
              ${!isActive && !isPast ? "text-white/70 hover:bg-white/10" : ""}
            `}
            aria-current={isActive ? "step" : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{id}</span>
          </button>
        );
      })}
    </nav>
  );
}
