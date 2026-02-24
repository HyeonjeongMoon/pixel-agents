"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { applyEvent } from "@/lib/reducer";
import type { AgentEvent, StateSnapshot } from "@/lib/types";

interface Props {
  initialSnapshot: StateSnapshot;
  events: AgentEvent[];
}

function bubbleLabel(type: "waiting" | "permission" | null, visible: boolean): string {
  if (!visible || !type) return "-";
  return type;
}

function statusClass(status: string): string {
  if (status === "active") return "agentSprite active";
  if (status === "waiting") return "agentSprite idle";
  if (status === "error") return "agentSprite error";
  return "agentSprite idle";
}

function displayStatus(status: string): string {
  return status === "waiting" ? "idle" : status;
}

function speechText(status: string, toolStatus: string | null): string | null {
  if (displayStatus(status) !== "active") return null;
  if (!toolStatus) return null;
  const cleaned = toolStatus.replace(/\s*\(완료\)\s*$/u, "").trim();
  if (!cleaned) return null;
  return cleaned.length > 36 ? `${cleaned.slice(0, 36)}…` : cleaned;
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

export default function Dashboard({ initialSnapshot, events }: Props) {
  const [cursor, setCursor] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const state = useMemo(() => {
    let next = initialSnapshot;
    for (let i = 0; i < cursor; i += 1) {
      next = applyEvent(next, events[i]);
    }
    return next;
  }, [cursor, events, initialSnapshot]);

  const recentLogsByAgent = useMemo(() => {
    const logs = new Map<string, string[]>();
    for (const agent of initialSnapshot.agents) {
      logs.set(agent.agent_id, []);
    }

    for (let i = 0; i < cursor; i += 1) {
      const event = events[i];
      const line = eventLogLine(event);
      if (!line) continue;
      const current = logs.get(event.agent_id) ?? [];
      current.push(line);
      logs.set(event.agent_id, current.slice(-5));
    }
    return logs;
  }, [cursor, events, initialSnapshot.agents]);

  const progress = `${cursor}/${events.length}`;

  useEffect(() => {
    if (!isPlaying) return;
    if (cursor >= events.length) {
      setIsPlaying(false);
      return;
    }
    const timer = setInterval(() => {
      setCursor((prev) => {
        if (prev >= events.length) {
          return prev;
        }
        return prev + 1;
      });
    }, 200);
    return () => clearInterval(timer);
  }, [isPlaying, cursor, events.length]);

  const step = () => {
    setIsPlaying(false);
    setCursor((prev) => Math.min(prev + 1, events.length));
  };
  const reset = () => {
    setIsPlaying(false);
    setCursor(0);
  };
  const playAll = () => {
    if (cursor >= events.length) return;
    setIsPlaying((prev) => !prev);
  };

  return (
    <main className="page">
      <header className="header">
        <div>
          <h1>Agent Dashboard (Mock)</h1>
          <p>run_id: {state.run_id}</p>
        </div>
        <div className="controls">
          <button onClick={step} disabled={cursor >= events.length}>Step</button>
          <button onClick={playAll} disabled={cursor >= events.length}>
            {isPlaying ? "Pause" : "Play All"}
          </button>
          <button onClick={reset} disabled={cursor === 0}>Reset</button>
        </div>
      </header>

      <section className="card">
        <h2>Layout</h2>
        <p>{state.layout.title ?? "Untitled"} ({state.layout.cols} x {state.layout.rows})</p>
        <p>event progress: {progress}</p>
      </section>

      <section className="card">
        <h2>Pixel Office Preview</h2>
        <div
          className="officeGrid"
          style={
            {
              "--cols": state.layout.cols,
              "--rows": state.layout.rows,
            } as CSSProperties
          }
        >
          {(state.layout.furniture ?? []).map((item) => (
            <div
              key={item.id}
              className={`furniture furniture-${item.type}`}
              style={
                {
                  "--col": item.col,
                  "--row": item.row,
                  "--w": item.w ?? 1,
                  "--h": item.h ?? 1,
                } as CSSProperties
              }
              title={`${item.type} (${item.col}, ${item.row})`}
            />
          ))}

          {state.agents.map((agent) => (
            (() => {
              const speech = speechText(agent.status, agent.tool_status);
              return (
                <div
                  key={agent.agent_id}
                  className="agentSpriteWrap"
                  style={
                    {
                      "--col": agent.position.col,
                      "--row": agent.position.row,
                    } as CSSProperties
                  }
                  title={`${agent.name} (${agent.status})`}
                >
                  {speech ? <div className="workSpeech">{speech}</div> : null}
                  {agent.bubble.visible && agent.bubble.type ? (
                    <span className={`bubble ${agent.bubble.type}`}>{agent.bubble.type}</span>
                  ) : null}
                  <span className={statusClass(agent.status)}>
                    <span className="head" />
                    <span className="body" />
                    <span className="legs" />
                  </span>
                  <span className="agentNameTag">{agent.name}</span>
                  <div className="workTooltip">
                    <p className="workTooltipTitle">최근 작업 5개</p>
                    <ol>
                      {(recentLogsByAgent.get(agent.agent_id) ?? []).length === 0 ? (
                        <li>아직 작업 로그 없음</li>
                      ) : (
                        (recentLogsByAgent.get(agent.agent_id) ?? []).slice().reverse().map((line, idx) => (
                          <li key={`${agent.agent_id}-${idx}`}>{line}</li>
                        ))
                      )}
                    </ol>
                  </div>
                </div>
              );
            })()
          ))}
        </div>
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
          {events.map((event, index) => (
            <li key={event.seq} className={index < cursor ? "event done" : "event"}>
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
          <li><code>data/mocks/state.snapshot.json</code></li>
          <li><code>data/mocks/events.json</code></li>
        </ul>
      </section>
    </main>
  );
}
