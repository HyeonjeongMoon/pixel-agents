import { loadEvents, loadSnapshot } from "@/lib/mockStore";
import { getLiveBridge } from "@/lib/liveBridge";
import type { AgentEvent, StateSnapshot } from "@/lib/types";

export type DashboardDataSource = "mock" | "live";

export function getDataSource(): DashboardDataSource {
  return process.env.AGENT_DASHBOARD_SOURCE === "live" ? "live" : "mock";
}

export function loadStateSnapshot(): StateSnapshot {
  const source = getDataSource();
  if (source === "live") {
    return getLiveBridge().getSnapshot();
  }
  return loadSnapshot();
}

export function loadAgentEvents(afterSeq = 0): AgentEvent[] {
  const source = getDataSource();
  if (source === "live") {
    return getLiveBridge().listEvents(afterSeq);
  }

  const events = loadEvents();
  if (afterSeq <= 0) return events;
  return events.filter((event) => event.seq > afterSeq);
}
