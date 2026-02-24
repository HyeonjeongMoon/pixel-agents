export interface RpcMessageBase {
  jsonrpc: "2.0";
}

export interface RpcRequest extends RpcMessageBase {
  id: number;
  method: string;
  params?: unknown;
}

export interface RpcNotification extends RpcMessageBase {
  method: string;
  params?: unknown;
}

export interface RpcSuccess extends RpcMessageBase {
  id: number;
  result: unknown;
}

export interface RpcError extends RpcMessageBase {
  id: number;
  error: { code: number; message: string };
}

export type RpcIncoming = RpcNotification | RpcSuccess | RpcError;

export interface TaskItem {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  owner?: string;
}

export interface ToolResultPayload {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: {
    title?: string;
    tasks?: TaskItem[];
  };
}

export interface OpenAiGlobals {
  toolInput?: Record<string, unknown>;
  toolOutput?: ToolResultPayload["structuredContent"];
}
