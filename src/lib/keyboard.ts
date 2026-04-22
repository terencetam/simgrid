import { useEffect } from "react";

export interface Shortcut {
  key: string;
  mod: boolean; // requires Cmd/Ctrl
  label: string;
  description: string;
}

export const SHORTCUTS: Shortcut[] = [
  { key: "Enter", mod: true, label: "Cmd+Enter", description: "Run simulation" },
  { key: "s", mod: true, label: "Cmd+S", description: "Save scenario" },
  { key: "1", mod: false, label: "1", description: "Chart tab" },
  { key: "2", mod: false, label: "2", description: "Financials tab" },
  { key: "3", mod: false, label: "3", description: "Unit Econ tab" },
  { key: "4", mod: false, label: "4", description: "Sensitivity tab" },
  { key: "5", mod: false, label: "5", description: "Model tab" },
  { key: "6", mod: false, label: "6", description: "Compare tab" },
  { key: "Escape", mod: false, label: "Esc", description: "Close modal / help" },
  { key: "?", mod: false, label: "?", description: "Toggle shortcuts help" },
];

const VIEW_KEYS: Record<string, string> = {
  "1": "chart",
  "2": "financials",
  "3": "unitEcon",
  "4": "sensitivity",
  "5": "model",
  "6": "compare",
};

interface ShortcutActions {
  run: () => void;
  save: () => void;
  setView: (view: string) => void;
  closeModal: () => void;
  toggleHelp: () => void;
}

export function useKeyboardShortcuts(actions: ShortcutActions): void {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      // Mod shortcuts work even in inputs
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === "Enter") {
        e.preventDefault();
        actions.run();
        return;
      }

      if (mod && e.key === "s") {
        e.preventDefault();
        actions.save();
        return;
      }

      // Non-mod shortcuts only fire outside inputs
      if (isInput) return;

      if (e.key === "Escape") {
        actions.closeModal();
        return;
      }

      if (e.key === "?") {
        actions.toggleHelp();
        return;
      }

      const view = VIEW_KEYS[e.key];
      if (view && !mod && !e.shiftKey && !e.altKey) {
        actions.setView(view);
        return;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [actions]);
}
