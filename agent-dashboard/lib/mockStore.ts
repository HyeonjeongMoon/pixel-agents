import fs from "node:fs";
import path from "node:path";
import type { AgentEvent, StateSnapshot } from "@/lib/types";

const ROOT = process.cwd();

function readJsonFile<T>(targetPath: string): T {
  const raw = fs.readFileSync(targetPath, "utf-8");
  return JSON.parse(raw) as T;
}

export function loadSnapshot(): StateSnapshot {
  return readJsonFile<StateSnapshot>(
    path.join(ROOT, "data", "mocks", "state.snapshot.json"),
  );
}

export function loadEvents(): AgentEvent[] {
  return readJsonFile<AgentEvent[]>(path.join(ROOT, "data", "mocks", "events.json"));
}
