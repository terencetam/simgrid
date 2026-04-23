import type { MonteCarloResult } from "@/engine/schema";

function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

const PERCENTILES = ["10", "50", "90"] as const;

export function exportResultsCSV(
  result: MonteCarloResult,
  scenarioName: string,
): void {
  // Discover all variable IDs in the percentiles
  const varIds = Object.keys(result.percentiles);
  if (varIds.length === 0) return;

  const headers = ["Month"];
  for (const varId of varIds) {
    for (const p of PERCENTILES) {
      headers.push(`${varId}_P${p}`);
    }
  }

  // Find T from the first available series
  let T = 0;
  for (const varId of varIds) {
    const len = result.percentiles[varId]?.["50"]?.length ?? 0;
    if (len > T) T = len;
  }

  const rows: string[] = [headers.join(",")];
  for (let t = 0; t < T; t++) {
    const cells: (string | number)[] = [t + 1];
    for (const varId of varIds) {
      for (const p of PERCENTILES) {
        const val = result.percentiles[varId]?.[p]?.[t];
        cells.push(val != null ? Math.round(val * 100) / 100 : "");
      }
    }
    rows.push(cells.join(","));
  }

  downloadCSV(rows.join("\n"), `${sanitizeName(scenarioName)}-results.csv`);
}
