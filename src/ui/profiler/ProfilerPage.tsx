import { useState } from "react";
import type { Scenario } from "@/engine/schema";
import type { Archetype } from "@/engine/profiler";
import { generateScenario } from "@/engine/profiler";
import { TEMPLATES } from "@/engine/templates";
import { ArchetypeSelector } from "./ArchetypeSelector";
import { QuestionForm } from "./QuestionForm";
import { TemplatePicker } from "./TemplatePicker";
import { ScenarioLibrary } from "@/ui/library/ScenarioLibrary";

type Step = "choose" | "questions" | "templates";

interface ProfilerPageProps {
  onComplete: (scenario: Scenario) => void;
}

export function ProfilerPage({ onComplete }: ProfilerPageProps) {
  const [step, setStep] = useState<Step>("choose");
  const [selectedArchetype, setSelectedArchetype] = useState<Archetype | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);

  const handleArchetypeSelect = (archetype: Archetype) => {
    setSelectedArchetype(archetype);
    setStep("questions");
  };

  const handleSubmit = (answers: Record<string, string | number | boolean>) => {
    if (!selectedArchetype) return;
    const scenario = generateScenario({
      archetype: selectedArchetype,
      stage: "early",
      answers,
    });
    onComplete(scenario);
  };

  const handleTemplateSelect = (id: string) => {
    const scenario = TEMPLATES[id];
    if (scenario) onComplete(structuredClone(scenario));
  };

  const handleLibraryLoad = (scenario: Scenario) => {
    setShowLibrary(false);
    onComplete(scenario);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-zinc-100 mb-2">SimGrid</h1>
          <p className="text-sm text-zinc-500">
            {step === "choose" && "What kind of business are you building?"}
            {step === "questions" && "Tell us about your business"}
            {step === "templates" && "Pick a template to start playing"}
          </p>
        </div>

        {/* Step content */}
        {step === "choose" && (
          <div className="flex flex-col gap-8">
            <ArchetypeSelector onSelect={handleArchetypeSelect} />
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-xs text-zinc-600">or</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>
            <div className="flex flex-col gap-2 items-center">
              <button
                onClick={() => setStep("templates")}
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Skip — pick a ready-made template
              </button>
              <button
                onClick={() => setShowLibrary(true)}
                className="text-sm text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                Load a saved scenario
              </button>
            </div>
          </div>
        )}

        {step === "questions" && selectedArchetype && (
          <QuestionForm
            archetype={selectedArchetype}
            onSubmit={handleSubmit}
            onBack={() => setStep("choose")}
          />
        )}

        {step === "templates" && (
          <div className="flex flex-col gap-6">
            <TemplatePicker onSelect={handleTemplateSelect} />
            <button
              onClick={() => setStep("choose")}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors text-center"
            >
              Back to profiler
            </button>
          </div>
        )}
      </div>

      {/* Library modal */}
      {showLibrary && (
        <ScenarioLibrary
          onLoad={handleLibraryLoad}
          onClose={() => setShowLibrary(false)}
        />
      )}
    </div>
  );
}
