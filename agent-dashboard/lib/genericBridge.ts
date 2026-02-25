import { applyEvent } from "@/lib/reducer";
import { loadSnapshot } from "@/lib/mockStore";
import type { AgentEvent, IngestEventInput, StateSnapshot } from "@/lib/types";

type Listener = (event: AgentEvent) => void;

const MAX_EVENTS = 10_000;

function cloneSnapshot(snapshot: StateSnapshot): StateSnapshot {
  return {
    ...snapshot,
    layout: {
      ...snapshot.layout,
      furniture: snapshot.layout.furniture?.map((item) => ({ ...item })),
    },
    agents: snapshot.agents.map((agent) => ({
      ...agent,
      position: { ...agent.position },
      bubble: { ...agent.bubble },
    })),
  };
}

class GenericBridge {
  private readonly baseSnapshot: StateSnapshot;

  private snapshot: StateSnapshot;

  private events: AgentEvent[] = [];

  private seq = 0;

  private readonly listeners = new Set<Listener>();

  constructor() {
    this.baseSnapshot = loadSnapshot();
    this.snapshot = {
      ...cloneSnapshot(this.baseSnapshot),
      run_id: "generic-run",
      snapshot_ts: new Date().toISOString(),
      agents: [],
    };
  }

  getSnapshot(): StateSnapshot {
    return cloneSnapshot(this.snapshot);
  }

  listEvents(afterSeq = 0): AgentEvent[] {
    if (afterSeq <= 0) return [...this.events];
    return this.events.filter((event) => event.seq > afterSeq);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  clear(): void {
    this.events = [];
    this.seq = 0;
    this.snapshot = {
      ...cloneSnapshot(this.baseSnapshot),
      run_id: "generic-run",
      snapshot_ts: new Date().toISOString(),
      agents: [],
    };
  }

  ingest(inputs: IngestEventInput[]): AgentEvent[] {
    const appended: AgentEvent[] = [];
    for (const input of inputs) {
      const event: AgentEvent = {
        seq: ++this.seq,
        ts: typeof input.ts === "string" && input.ts ? input.ts : new Date().toISOString(),
        run_id: typeof input.run_id === "string" && input.run_id ? input.run_id : this.snapshot.run_id,
        source: "generic",
        type: input.type,
        agent_id: input.agent_id,
        payload: input.payload ?? {},
      };

      this.events.push(event);
      if (this.events.length > MAX_EVENTS) {
        this.events = this.events.slice(this.events.length - MAX_EVENTS);
      }

      this.snapshot = applyEvent(this.snapshot, event);
      this.snapshot.snapshot_ts = event.ts;
      appended.push(event);
      for (const listener of this.listeners) listener(event);
    }

    return appended;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __pixelGenericBridge: GenericBridge | undefined;
}

export function getGenericBridge(): GenericBridge {
  if (!global.__pixelGenericBridge) {
    global.__pixelGenericBridge = new GenericBridge();
  }
  return global.__pixelGenericBridge;
}
