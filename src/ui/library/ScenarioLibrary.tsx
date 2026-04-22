import { useEffect, useState, useRef, useCallback } from "react";
import type { Scenario } from "@/engine/schema";
import {
  listScenarios,
  deleteScenario,
  duplicateScenario,
  type SavedScenario,
} from "@/lib/db";
import { importScenarioJSON } from "@/lib/file-io";
import { exportScenarioJSON } from "@/lib/file-io";
import { copyShareURL } from "@/lib/sharing";
import { ARCHETYPE_CONFIGS } from "@/engine/profiler";

interface ScenarioLibraryProps {
  onLoad: (scenario: Scenario) => void;
  onClose: () => void;
}

export function ScenarioLibrary({ onLoad, onClose }: ScenarioLibraryProps) {
  const [scenarios, setScenarios] = useState<SavedScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listScenarios();
      setScenarios(list);
      setError(null);
    } catch (err) {
      setError("Could not access saved scenarios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async (id: string) => {
    await deleteScenario(id);
    setConfirmDelete(null);
    refresh();
  };

  const handleDuplicate = async (id: string, name: string) => {
    await duplicateScenario(id, `${name} (copy)`);
    refresh();
  };

  const handleExport = (scenario: Scenario) => {
    exportScenarioJSON(scenario);
  };

  const handleShare = async (scenario: Scenario) => {
    try {
      await copyShareURL(scenario);
      setError("Share URL copied!");
      setTimeout(() => setError(null), 2000);
    } catch {
      setError("Failed to copy URL");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const scenario = await importScenarioJSON(file);
      onLoad(scenario);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import file");
    }
    e.target.value = "";
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = Date.now();
    const diff = now - ts;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">
            Scenario Library
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors text-lg"
          >
            ×
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-zinc-800 flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded transition-colors"
          >
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.simgrid.json"
            onChange={handleImport}
            className="hidden"
          />
          {error && (
            <span className="text-xs text-amber-400">{error}</span>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {loading ? (
            <div className="text-center text-zinc-600 py-8">Loading...</div>
          ) : scenarios.length === 0 ? (
            <div className="text-center text-zinc-600 py-12">
              <div className="text-3xl mb-3">📁</div>
              <div className="text-sm">No saved scenarios yet</div>
              <div className="text-xs text-zinc-700 mt-1">
                Save your current scenario to get started
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {scenarios.map((saved) => {
                const archConfig = saved.archetype
                  ? ARCHETYPE_CONFIGS[saved.archetype as keyof typeof ARCHETYPE_CONFIGS]
                  : null;

                return (
                  <div
                    key={saved.id}
                    className="flex items-center justify-between px-4 py-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-200 truncate">
                          {saved.name}
                        </span>
                        {archConfig && (
                          <span className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded shrink-0">
                            {archConfig.icon} {archConfig.name}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-600 mt-0.5">
                        Modified {formatDate(saved.updatedAt)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 ml-3 shrink-0">
                      <button
                        onClick={() => onLoad(saved.scenario)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 transition-colors"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDuplicate(saved.id, saved.name)}
                        className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 transition-colors"
                      >
                        Dup
                      </button>
                      <button
                        onClick={() => handleExport(saved.scenario)}
                        className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 transition-colors"
                      >
                        Export
                      </button>
                      <button
                        onClick={() => handleShare(saved.scenario)}
                        className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 transition-colors"
                      >
                        Share
                      </button>
                      {confirmDelete === saved.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(saved.id)}
                            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-xs text-zinc-500 hover:text-zinc-300 px-1 py-1 transition-colors"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(saved.id)}
                          className="text-xs text-zinc-600 hover:text-red-400 px-2 py-1 transition-colors"
                        >
                          Del
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
