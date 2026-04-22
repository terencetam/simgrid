import LZString from "lz-string";
import { Scenario } from "@/engine/schema";

export function encodeScenarioToURL(scenario: Scenario): string {
  const json = JSON.stringify(scenario);
  const compressed = LZString.compressToEncodedURIComponent(json);
  const base = window.location.origin + window.location.pathname;
  return `${base}?s=${compressed}`;
}

export function decodeScenarioFromURL(
  urlParam: string,
): Scenario | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(urlParam);
    if (!json) return null;
    const parsed = JSON.parse(json);
    const result = Scenario.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export async function copyShareURL(scenario: Scenario): Promise<void> {
  const url = encodeScenarioToURL(scenario);
  await navigator.clipboard.writeText(url);
}
