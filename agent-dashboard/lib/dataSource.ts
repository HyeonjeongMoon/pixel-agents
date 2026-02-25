import { getGenericBridge } from "@/lib/genericBridge";
import { getLiveBridge } from "@/lib/liveBridge";
import { loadEvents, loadSnapshot } from "@/lib/mockStore";
import type { AgentEvent, IngestEventInput, RuntimeSource, StateSnapshot } from "@/lib/types";

export type DashboardDataSource = RuntimeSource;

function parseSource(value: string | null | undefined): DashboardDataSource | null {
  if (!value) return null;
  if (value === "mock" || value === "claude" || value === "generic") return value;
  if (value === "live") return "claude";
  return null;
}

export function getDefaultSource(): DashboardDataSource {
  const mode = process.env.AGENT_SOURCE_MODE;
  if (mode === "generic") return "generic";
  if (mode === "claude" || mode === "dual") return "claude";

  const legacy = process.env.AGENT_DASHBOARD_SOURCE;
  if (legacy === "live") return "claude";
  if (legacy === "mock") return "mock";

  return "mock";
}

export function resolveDataSource(sourceParam?: string | null): DashboardDataSource {
  return parseSource(sourceParam) ?? getDefaultSource();
}

export function loadStateSnapshot(source: DashboardDataSource = getDefaultSource()): StateSnapshot {
  if (source === "claude") {
    return getLiveBridge().getSnapshot();
  }
  if (source === "generic") {
    return getGenericBridge().getSnapshot();
  }
  return loadSnapshot();
}

export function loadAgentEvents(
  source: DashboardDataSource = getDefaultSource(),
  afterSeq = 0,
): AgentEvent[] {
  if (source === "claude") {
    return getLiveBridge().listEvents(afterSeq).map((event) => ({ ...event, source: event.source ?? "claude" }));
  }
  if (source === "generic") {
    return getGenericBridge().listEvents(afterSeq).map((event) => ({ ...event, source: event.source ?? "generic" }));
  }

  const events = loadEvents();
  const normalized = events.map((event) => ({ ...event, source: "mock" as const }));
  if (afterSeq <= 0) return normalized;
  return normalized.filter((event) => event.seq > afterSeq);
}

export function subscribeToEvents(source: DashboardDataSource, listener: (event: AgentEvent) => void): () => void {
  if (source === "claude") {
    return getLiveBridge().subscribe(listener);
  }
  if (source === "generic") {
    return getGenericBridge().subscribe(listener);
  }
  return () => {};
}

export function ingestGenericEvents(inputs: IngestEventInput[]): AgentEvent[] {
  return getGenericBridge().ingest(inputs);
}

export function clearSourceLogs(source: DashboardDataSource): number {
  if (source === "claude") {
    return getLiveBridge().clearLogs();
  }
  if (source === "generic") {
    getGenericBridge().clear();
    return 0;
  }
  return 0;
}
