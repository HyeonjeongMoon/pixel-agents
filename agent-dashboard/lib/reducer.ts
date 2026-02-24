import type { AgentEvent, AgentModel, AgentStatus, StateSnapshot } from "@/lib/types";

function findAgent(state: StateSnapshot, agentId: string): AgentModel | undefined {
  return state.agents.find((agent) => agent.agent_id === agentId);
}

function toStatus(value: unknown): AgentStatus | null {
  if (value === "active" || value === "waiting" || value === "idle" || value === "error") {
    return value;
  }
  return null;
}

export function applyEvent(state: StateSnapshot, event: AgentEvent): StateSnapshot {
  const next: StateSnapshot = {
    ...state,
    agents: state.agents.map((agent) => ({ ...agent, bubble: { ...agent.bubble }, position: { ...agent.position } })),
  };

  if (event.type === "layout.updated") {
    const cols = typeof event.payload.cols === "number" ? event.payload.cols : next.layout.cols;
    const rows = typeof event.payload.rows === "number" ? event.payload.rows : next.layout.rows;
    next.layout = { ...next.layout, cols, rows };
    return next;
  }

  if (event.type === "agent.created" || event.type === "agent.subagent.created") {
    const exists = findAgent(next, event.agent_id);
    if (!exists) {
      next.agents.push({
        agent_id: event.agent_id,
        name: String(event.payload.name ?? event.agent_id),
        kind: event.type === "agent.subagent.created" ? "subagent" : "primary",
        parent_agent_id: typeof event.payload.parent_agent_id === "string" ? event.payload.parent_agent_id : undefined,
        status: "active",
        tool_status: null,
        seat_id: typeof event.payload.seat_id === "string" ? event.payload.seat_id : null,
        position: {
          col: typeof event.payload.col === "number" ? event.payload.col : 0,
          row: typeof event.payload.row === "number" ? event.payload.row : 0,
        },
        bubble: { type: null, visible: false },
        updated_at: event.ts,
      });
    }
    return next;
  }

  const target = findAgent(next, event.agent_id);
  if (!target) return next;

  target.updated_at = event.ts;

  switch (event.type) {
    case "agent.status.changed": {
      const status = toStatus(event.payload.status);
      if (status) {
        // waiting은 시각적으로 노출하지 않고, 직전 작업 컨텍스트를 유지한다.
        target.status = status === "waiting" ? "idle" : status;
        target.bubble = { type: null, visible: false };
      }
      break;
    }
    case "agent.tool.started": {
      target.status = "active";
      target.tool_status = typeof event.payload.status === "string" ? event.payload.status : "Running tool";
      target.bubble = { type: null, visible: false };
      break;
    }
    case "agent.tool.finished": {
      // 완료 후에도 마지막 작업 내용을 유지해 흐름을 추적하기 쉽게 한다.
      if (target.tool_status) {
        target.tool_status = `${target.tool_status} (완료)`;
      }
      break;
    }
    case "agent.permission.waiting": {
      target.bubble = { type: "permission", visible: true };
      break;
    }
    case "agent.permission.cleared": {
      target.bubble = { type: null, visible: false };
      break;
    }
    case "agent.position.changed": {
      const payloadPos = event.payload.position as { col?: number; row?: number } | undefined;
      target.position = {
        col: typeof payloadPos?.col === "number" ? payloadPos.col : target.position.col,
        row: typeof payloadPos?.row === "number" ? payloadPos.row : target.position.row,
      };
      break;
    }
    case "agent.seat.assigned": {
      target.seat_id = typeof event.payload.seat_id === "string" ? event.payload.seat_id : target.seat_id;
      break;
    }
    case "agent.tools.cleared": {
      target.tool_status = null;
      break;
    }
    case "agent.subagent.removed":
    case "agent.removed": {
      next.agents = next.agents.filter((agent) => agent.agent_id !== event.agent_id);
      break;
    }
    default:
      break;
  }

  return next;
}

export function replayEvents(snapshot: StateSnapshot, events: AgentEvent[]): StateSnapshot {
  return events.reduce((acc, event) => applyEvent(acc, event), snapshot);
}
