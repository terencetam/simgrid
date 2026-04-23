import Dexie, { type EntityTable } from "dexie";
import type { Scenario } from "@/engine/schema";

export interface SavedScenario {
  id: string;
  name: string;
  archetype?: string;
  createdAt: number;
  updatedAt: number;
  scenario: Scenario;
}

class SimGridDB extends Dexie {
  scenarios!: EntityTable<SavedScenario, "id">;

  constructor() {
    super("simgrid");
    this.version(2).stores({
      scenarios: "id, updatedAt",
    });
  }
}

export const db = new SimGridDB();

export async function saveScenario(scenario: Scenario): Promise<string> {
  const id = scenario.id;
  const existing = await db.scenarios.get(id);
  const now = Date.now();

  const entry: SavedScenario = {
    id,
    name: scenario.name,
    archetype: scenario.businessProfile?.archetype,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    scenario,
  };

  await db.scenarios.put(entry);
  return id;
}

export async function getSavedScenario(
  id: string,
): Promise<SavedScenario | undefined> {
  return db.scenarios.get(id);
}

export async function listScenarios(): Promise<SavedScenario[]> {
  return db.scenarios.orderBy("updatedAt").reverse().toArray();
}

export async function deleteScenario(id: string): Promise<void> {
  await db.scenarios.delete(id);
}

export async function duplicateScenario(
  id: string,
  newName: string,
): Promise<string> {
  const existing = await db.scenarios.get(id);
  if (!existing) throw new Error(`Scenario ${id} not found`);

  const newId = `${id}-copy-${Date.now()}`;
  const clone = structuredClone(existing.scenario);
  clone.id = newId;
  clone.name = newName;

  const now = Date.now();
  await db.scenarios.put({
    id: newId,
    name: newName,
    archetype: existing.archetype,
    createdAt: now,
    updatedAt: now,
    scenario: clone,
  });

  return newId;
}
