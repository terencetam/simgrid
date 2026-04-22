import { useEffect, useState } from "react";
import { useScenarioStore } from "@/store/scenario-store";
import { Dashboard } from "@/ui/dashboard/Dashboard";
import { ProfilerPage } from "@/ui/profiler/ProfilerPage";
import { decodeScenarioFromURL } from "@/lib/sharing";

export default function App() {
  const showProfiler = useScenarioStore((s) => s.showProfiler);
  const loadScenario = useScenarioStore((s) => s.loadScenario);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("s");
    if (encoded) {
      try {
        const scenario = decodeScenarioFromURL(encoded);
        if (scenario) {
          loadScenario(scenario);
        }
      } catch (err) {
        console.warn("Failed to decode shared scenario URL:", err);
      }
      window.history.replaceState({}, "", window.location.pathname);
    }
    setReady(true);
  }, [loadScenario]);

  if (!ready) return null;

  if (showProfiler) {
    return <ProfilerPage onComplete={loadScenario} />;
  }

  return <Dashboard />;
}
