export type AgentStatus = "active" | "waiting" | "idle" | "error";

export type AgentKind = "primary" | "subagent";

export interface Position {
  col: number;
  row: number;
}

export interface BubbleState {
  type: "waiting" | "permission" | null;
  visible: boolean;
}

export interface AgentModel {
  agent_id: string;
  name: string;
  kind: AgentKind;
  parent_agent_id?: string;
  status: AgentStatus;
  tool_status: string | null;
  seat_id: string | null;
  position: Position;
  bubble: BubbleState;
  updated_at: string;
}

export interface LayoutModel {
  version: number;
  cols: number;
  rows: number;
  title?: string;
  furniture?: FurnitureItem[];
}

export type FurnitureType =
  | "desk"
  | "chair"
  | "cabinet"
  | "plant"
  | "whiteboard"
  | "table"
  | "bookshelf"
  | "cooler"
  | "counter";

export interface FurnitureItem {
  id: string;
  type: FurnitureType;
  col: number;
  row: number;
  w?: number;
  h?: number;
}

export interface StateSnapshot {
  run_id: string;
  snapshot_ts: string;
  layout: LayoutModel;
  agents: AgentModel[];
}

export type EventType =
  | "agent.created"
  | "agent.status.changed"
  | "agent.tool.started"
  | "agent.tool.finished"
  | "agent.permission.waiting"
  | "agent.permission.cleared"
  | "agent.position.changed"
  | "agent.seat.assigned"
  | "agent.subagent.created"
  | "agent.subagent.removed"
  | "agent.tools.cleared"
  | "agent.removed"
  | "layout.updated";

export interface AgentEvent {
  seq: number;
  ts: string;
  run_id: string;
  type: EventType;
  agent_id: string;
  payload: Record<string, unknown>;
}
