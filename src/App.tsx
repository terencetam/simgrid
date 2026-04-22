import { useScenarioStore } from "@/store/scenario-store";
import { Dashboard } from "@/ui/dashboard/Dashboard";
import { ProfilerPage } from "@/ui/profiler/ProfilerPage";

export default function App() {
  const showProfiler = useScenarioStore((s) => s.showProfiler);
  const loadScenario = useScenarioStore((s) => s.loadScenario);

  if (showProfiler) {
    return <ProfilerPage onComplete={loadScenario} />;
  }

  return <Dashboard />;
}
