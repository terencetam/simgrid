import { Scenario } from "@/engine/schema";

export function exportScenarioJSON(scenario: Scenario): void {
  const json = JSON.stringify(scenario, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const name = scenario.name
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase();

  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.simgrid.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importScenarioJSON(file: File): Promise<Scenario> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON file");
  }
  const result = Scenario.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid scenario: ${result.error.message}`);
  }
  return result.data;
}
