"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { applyEvent } from "@/lib/reducer";
import type { AgentEvent, StateSnapshot } from "@/lib/types";
import type { DashboardDataSource } from "@/lib/dataSource";
import PixelOfficeCanvas from "@/components/PixelOfficeCanvas";

interface Props {
  initialSnapshot: StateSnapshot;
  events: AgentEvent[];
  dataSource: DashboardDataSource;
}

function displayStatus(status: string): string {
  return status === "waiting" ? "idle" : status;
}

function bubbleLabel(type: "waiting" | "permission" | null, visible: boolean): string {
  if (!visible || !type) return "-";
  return type;
}

function eventLogLine(event: AgentEvent): string | null {
  const time = event.ts.slice(11, 19);
  switch (event.type) {
    case "agent.tool.started":
      return `${time} 시작: ${String(event.payload.status ?? "도구 실행")}`;
    case "agent.tool.finished":
      return `${time} 완료: ${String(event.payload.tool_id ?? "tool")}`;
    case "agent.status.changed": {
      const status = String(event.payload.status ?? "-");
      if (status === "active" || status === "idle" || status === "waiting") return null;
      return `${time} 상태: ${status}`;
    }
    case "agent.permission.waiting":
      return `${time} 권한 대기 발생`;
    case "agent.permission.cleared":
      return `${time} 권한 대기 해제`;
    case "agent.position.changed":
      return null;
    case "agent.seat.assigned":
      return `${time} 좌석: ${String(event.payload.seat_id ?? "-")}`;
    default:
      return null;
  }
}

export default function Dashboard({ initialSnapshot, events, dataSource }: Props) {
  const isLive = dataSource === "live";
  const [cursor, setCursor] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [liveSnapshot, setLiveSnapshot] = useState<StateSnapshot>(initialSnapshot);
  const [liveEvents, setLiveEvents] = useState<AgentEvent[]>(events);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationCursor, setSimulationCursor] = useState(0);
  const lastSeqRef = useRef<number>(events.at(-1)?.seq ?? 0);

  const eventList = isLive ? liveEvents : events;
  const liveBaseSnapshot = useMemo<StateSnapshot>(() => ({
    run_id: "live-run",
    snapshot_ts: new Date(0).toISOString(),
    layout: { ...liveSnapshot.layout, furniture: liveSnapshot.layout.furniture?.map((item) => ({ ...item })) },
    agents: [],
  }), [liveSnapshot.layout]);
  const appliedCursor = isLive
    ? (isSimulating ? simulationCursor : eventList.length)
    : cursor;

  const replayState = useMemo(() => {
    let next = isLive ? liveBaseSnapshot : initialSnapshot;
    for (let i = 0; i < appliedCursor; i += 1) {
      next = applyEvent(next, eventList[i]);
    }
    return next;
  }, [appliedCursor, eventList, initialSnapshot, isLive, liveBaseSnapshot]);

  const state = isLive
    ? (isSimulating ? replayState : liveSnapshot)
    : replayState;

  const recentLogsByAgent = useMemo(() => {
    const logs = new Map<string, string[]>();
    for (const agent of initialSnapshot.agents) {
      logs.set(agent.agent_id, []);
    }

    for (let i = 0; i < appliedCursor; i += 1) {
      const event = eventList[i];
      const line = eventLogLine(event);
      if (!line) continue;
      const current = logs.get(event.agent_id) ?? [];
      current.push(line);
      logs.set(event.agent_id, current.slice(-5));
    }
    return logs;
  }, [appliedCursor, eventList, initialSnapshot.agents]);

  const progress = `${appliedCursor}/${eventList.length}`;

  useEffect(() => {
    if (isLive) return;
    if (!isPlaying) return;
    if (cursor >= eventList.length) {
      setIsPlaying(false);
      return;
    }
    const timer = setInterval(() => {
      setCursor((prev) => {
        if (prev >= eventList.length) {
          return prev;
        }
        return prev + 1;
      });
    }, 200);
    return () => clearInterval(timer);
  }, [isLive, isPlaying, cursor, eventList.length]);

  useEffect(() => {
    if (!isLive) {
      setLiveSnapshot(initialSnapshot);
      setLiveEvents(events);
      setIsSimulating(false);
      setSimulationCursor(0);
      lastSeqRef.current = events.at(-1)?.seq ?? 0;
      return;
    }

    let cancelled = false;

    const syncBootstrap = async () => {
      const [snapshotRes, eventsRes] = await Promise.all([
        fetch("/api/v1/state", { cache: "no-store" }),
        fetch("/api/v1/events", { cache: "no-store" }),
      ]);
      if (!snapshotRes.ok || !eventsRes.ok || cancelled) return;
      const [nextSnapshot, nextEvents] = await Promise.all([
        snapshotRes.json() as Promise<StateSnapshot>,
        eventsRes.json() as Promise<AgentEvent[]>,
      ]);
      if (cancelled) return;
      setLiveSnapshot(nextSnapshot);
      setLiveEvents(nextEvents);
      lastSeqRef.current = nextEvents.at(-1)?.seq ?? 0;
    };

    void syncBootstrap();

    const source = new EventSource(`/api/v1/stream?after_seq=${lastSeqRef.current}`);
    source.addEventListener("message", (rawEvent) => {
      try {
        const event = JSON.parse(rawEvent.data) as AgentEvent;
        setLiveEvents((prev) => {
          if (prev.some((item) => item.seq === event.seq)) return prev;
          return [...prev, event];
        });
        setLiveSnapshot((prev) => applyEvent(prev, event));
        lastSeqRef.current = Math.max(lastSeqRef.current, event.seq);
      } catch {
        // ignore malformed stream lines
      }
    });

    return () => {
      cancelled = true;
      source.close();
    };
  }, [isLive, initialSnapshot, events]);

  useEffect(() => {
    if (!isLive || !isSimulating) return;
    if (simulationCursor >= eventList.length) {
      setIsSimulating(false);
      return;
    }

    const current = eventList[simulationCursor];
    const previous = simulationCursor > 0 ? eventList[simulationCursor - 1] : null;
    const currentMs = Date.parse(current?.ts ?? "");
    const previousMs = previous ? Date.parse(previous.ts) : Number.NaN;
    const rawDelta = Number.isFinite(currentMs) && Number.isFinite(previousMs)
      ? Math.max(0, currentMs - previousMs)
      : 0;
    const delayMs = simulationCursor === 0 ? 0 : Math.max(20, Math.floor(rawDelta));

    const timer = setTimeout(() => {
      setSimulationCursor((prev) => Math.min(prev + 1, eventList.length));
    }, delayMs);

    return () => clearTimeout(timer);
  }, [isLive, isSimulating, simulationCursor, eventList]);

  const step = () => {
    setIsPlaying(false);
    setCursor((prev) => Math.min(prev + 1, eventList.length));
  };
  const reset = () => {
    setIsPlaying(false);
    setCursor(0);
  };
  const playAll = () => {
    if (cursor >= eventList.length) return;
    setIsPlaying((prev) => !prev);
  };
  const startSimulation = () => {
    if (!isLive) return;
    setIsSimulating(true);
    setSimulationCursor(0);
  };
  const stopSimulation = () => {
    if (!isLive) return;
    setIsSimulating(false);
    setSimulationCursor(0);
  };

  return (
    <main className="page">
      <header className="header">
        <div>
          <h1>{isLive ? "Agent Dashboard (Live)" : "Agent Dashboard (Mock)"}</h1>
          <p>run_id: {state.run_id}</p>
        </div>
        <div className="controls">
          {isLive ? (
            <>
              <button onClick={startSimulation} disabled={isSimulating || eventList.length === 0}>
                Simulate (x1)
              </button>
              <button onClick={stopSimulation} disabled={!isSimulating}>
                Stop Sim
              </button>
            </>
          ) : (
            <>
              <button onClick={step} disabled={cursor >= eventList.length}>Step</button>
              <button onClick={playAll} disabled={cursor >= eventList.length}>
                {isPlaying ? "Pause" : "Play All"}
              </button>
              <button onClick={reset} disabled={cursor === 0}>Reset</button>
            </>
          )}
        </div>
      </header>

      <section className="card">
        <h2>Layout</h2>
        <p>{state.layout.title ?? "Untitled"} ({state.layout.cols} x {state.layout.rows})</p>
        <p>event progress: {progress}</p>
      </section>

      <section className="card">
        <h2>Pixel Office</h2>
        <PixelOfficeCanvas state={state} />
      </section>

      <section className="card">
        <h2>Agents</h2>
        <div className="agents">
          {state.agents.map((agent) => (
            <article className="agent" key={agent.agent_id}>
              <h3>{agent.name}</h3>
              <p><b>id</b>: {agent.agent_id}</p>
              <p><b>kind</b>: {agent.kind}</p>
              <p><b>status</b>: {displayStatus(agent.status)}</p>
              <p><b>tool</b>: {agent.tool_status ?? "-"}</p>
              <p><b>seat</b>: {agent.seat_id ?? "-"}</p>
              <p><b>position</b>: ({agent.position.col}, {agent.position.row})</p>
              <p><b>bubble</b>: {bubbleLabel(agent.bubble.type, agent.bubble.visible)}</p>
              <p><b>updated</b>: {agent.updated_at}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Events</h2>
        <ol className="events">
          {eventList.map((event, index) => (
            <li key={event.seq} className={index < appliedCursor ? "event done" : "event"}>
              <span>#{event.seq}</span>
              <span>{event.type}</span>
              <span>{event.agent_id}</span>
              <span>{event.ts}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card">
        <h2>Spec Files</h2>
        <ul>
          <li><code>data/openapi/openapi.yaml</code></li>
          <li><code>data/schemas/event-envelope.schema.json</code></li>
          <li><code>data/schemas/state-snapshot.schema.json</code></li>
          {isLive ? (
            <li><code>~/.claude/projects/&lt;workspace-hash&gt;/*.jsonl</code></li>
          ) : (
            <>
              <li><code>data/mocks/state.snapshot.json</code></li>
              <li><code>data/mocks/events.json</code></li>
            </>
          )}
        </ul>
      </section>
    </main>
  );
}
