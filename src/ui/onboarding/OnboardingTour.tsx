import { useState, useEffect, useCallback } from "react";

interface TourStep {
  targetSelector: string;
  title: string;
  body: string;
  position: "top" | "bottom" | "left" | "right";
}

interface OnboardingTourProps {
  steps: TourStep[];
  onComplete: () => void;
}

const TOUR_STEPS: TourStep[] = [
  {
    targetSelector: "[data-tour='levers']",
    title: "Your business levers",
    body: "Drag these sliders to change assumptions like price, marketing spend, and hiring.",
    position: "right",
  },
  {
    targetSelector: "[data-tour='run-button']",
    title: "Run the simulation",
    body: "Press Run to simulate 1,000 possible futures with your current settings.",
    position: "top",
  },
  {
    targetSelector: "[data-tour='chart']",
    title: "The fan chart",
    body: "See the range of outcomes. The dark band is the most likely range (P25-P75).",
    position: "bottom",
  },
  {
    targetSelector: "[data-tour='view-tabs']",
    title: "Explore deeper",
    body: "Switch tabs to see financials, unit economics, sensitivity analysis, and more.",
    position: "bottom",
  },
];

function getTooltipStyle(
  rect: DOMRect,
  position: TourStep["position"],
): React.CSSProperties {
  const gap = 12;
  const base: React.CSSProperties = { position: "fixed", zIndex: 60 };

  switch (position) {
    case "right":
      return { ...base, left: rect.right + gap, top: rect.top + rect.height / 2, transform: "translateY(-50%)" };
    case "left":
      return { ...base, right: window.innerWidth - rect.left + gap, top: rect.top + rect.height / 2, transform: "translateY(-50%)" };
    case "bottom":
      return { ...base, left: rect.left + rect.width / 2, top: rect.bottom + gap, transform: "translateX(-50%)" };
    case "top":
      return { ...base, left: rect.left + rect.width / 2, bottom: window.innerHeight - rect.top + gap, transform: "translateX(-50%)" };
  }
}

export function OnboardingTour({ steps = TOUR_STEPS, onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const step = steps[currentStep];

  const measureTarget = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.targetSelector);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    }
  }, [step]);

  useEffect(() => {
    measureTarget();
    window.addEventListener("resize", measureTarget);
    return () => window.removeEventListener("resize", measureTarget);
  }, [measureTarget]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      onComplete();
    }
  };

  if (!step || !targetRect) return null;

  const tooltipStyle = getTooltipStyle(targetRect, step.position);
  const pad = 8;

  return (
    <>
      {/* Backdrop with cutout */}
      <div className="fixed inset-0 z-50">
        <svg width="100%" height="100%" className="absolute inset-0">
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={targetRect.left - pad}
                y={targetRect.top - pad}
                width={targetRect.width + pad * 2}
                height={targetRect.height + pad * 2}
                rx={8}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.6)"
            mask="url(#tour-mask)"
          />
        </svg>

        {/* Highlight border */}
        <div
          className="absolute border-2 border-indigo-500 rounded-lg pointer-events-none"
          style={{
            left: targetRect.left - pad,
            top: targetRect.top - pad,
            width: targetRect.width + pad * 2,
            height: targetRect.height + pad * 2,
          }}
        />
      </div>

      {/* Tooltip */}
      <div style={tooltipStyle} className="max-w-xs">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-4">
          <div className="text-sm font-semibold text-zinc-100 mb-1">{step.title}</div>
          <div className="text-xs text-zinc-400 mb-3">{step.body}</div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-600">
              {currentStep + 1} of {steps.length}
            </span>
            <div className="flex gap-2">
              <button
                onClick={onComplete}
                className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleNext}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded transition-colors"
              >
                {currentStep < steps.length - 1 ? "Next" : "Done"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

OnboardingTour.defaultSteps = TOUR_STEPS;
