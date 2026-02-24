import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyEvent } from "@/lib/reducer";
import { loadSnapshot } from "@/lib/mockStore";
import type { AgentEvent, Position, StateSnapshot } from "@/lib/types";

interface FileState {
  filePath: string;
  sessionId: string;
  agentId: string;
  offset: number;
  lineBuffer: string;
  watcher?: fs.FSWatcher;
}

type Listener = (event: AgentEvent) => void;

const MAX_EVENTS = 10_000;
const SCAN_INTERVAL_MS = 1_000;

interface TaskMeta {
  parentAgentId: string;
  description: string | null;
}

function normalizeWorkspacePath(workspacePath: string): string {
  return workspacePath.replace(/[:\\/]/g, "-");
}

function resolveWorkspacePath(): string {
  if (process.env.PIXEL_WORKSPACE_ROOT && process.env.PIXEL_WORKSPACE_ROOT.trim()) {
    return path.resolve(process.env.PIXEL_WORKSPACE_ROOT);
  }
  return path.resolve(process.cwd(), "..");
}

function resolveClaudeProjectDir(): string {
  if (process.env.CLAUDE_PROJECT_DIR && process.env.CLAUDE_PROJECT_DIR.trim()) {
    return path.resolve(process.env.CLAUDE_PROJECT_DIR);
  }
  const workspacePath = resolveWorkspacePath();
  return path.join(os.homedir(), ".claude", "projects", normalizeWorkspacePath(workspacePath));
}

function formatToolStatus(toolName: string, input: Record<string, unknown>): string {
  const base = (value: unknown): string => (typeof value === "string" ? path.basename(value) : "");
  switch (toolName) {
    case "Read":
      return `Reading ${base(input.file_path)}`;
    case "Edit":
      return `Editing ${base(input.file_path)}`;
    case "Write":
      return `Writing ${base(input.file_path)}`;
    case "Bash": {
      const command = typeof input.command === "string" ? input.command : "";
      return command ? `Running: ${command}` : "Running: command";
    }
    case "Grep":
      return "Searching code";
    case "Glob":
      return "Searching files";
    case "Task":
      return typeof input.description === "string" ? `Subtask: ${input.description}` : "Running subtask";
    default:
      return `Using ${toolName}`;
  }
}

class LiveAgentBridge {
  private readonly claudeProjectDir: string;

  private readonly seatPool: Position[];

  private readonly fileStates = new Map<string, FileState>();

  private readonly listeners = new Set<Listener>();

  private readonly sessionToAgentId = new Map<string, string>();

  private readonly activeTools = new Map<string, Map<string, string>>();

  private readonly taskMetaByToolId = new Map<string, TaskMeta>();

  private readonly subAgentByParentToolId = new Map<string, string>();

  private readonly baseSnapshot: StateSnapshot;

  private state: StateSnapshot;

  private events: AgentEvent[] = [];

  private seq = 0;

  private initialized = false;

  private scanTimer: NodeJS.Timeout | null = null;

  private agentCounter = 0;

  constructor() {
    this.claudeProjectDir = resolveClaudeProjectDir();
    this.baseSnapshot = loadSnapshot();
    this.state = {
      ...this.baseSnapshot,
      run_id: "live-run",
      snapshot_ts: new Date().toISOString(),
      agents: [],
    };
    this.seatPool = this.buildSeatPool(this.baseSnapshot);
  }

  start(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.scanAndAttach();
    this.scanTimer = setInterval(() => this.scanAndAttach(), SCAN_INTERVAL_MS);
  }

  getSnapshot(): StateSnapshot {
    return {
      ...this.state,
      layout: { ...this.state.layout, furniture: this.state.layout.furniture?.map((item) => ({ ...item })) },
      agents: this.state.agents.map((agent) => ({
        ...agent,
        position: { ...agent.position },
        bubble: { ...agent.bubble },
      })),
    };
  }

  listEvents(afterSeq = 0): AgentEvent[] {
    if (afterSeq <= 0) return [...this.events];
    return this.events.filter((event) => event.seq > afterSeq);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private buildSeatPool(snapshot: StateSnapshot): Position[] {
    const chairs = (snapshot.layout.furniture ?? [])
      .filter((item) => item.type === "chair")
      .map((item) => ({ col: item.col, row: item.row }))
      .sort((a, b) => (a.row - b.row) || (a.col - b.col));

    if (chairs.length > 0) return chairs;

    const fallback: Position[] = [];
    for (let row = 4; row < snapshot.layout.rows; row += 3) {
      for (let col = 4; col < snapshot.layout.cols; col += 6) {
        fallback.push({ col, row });
      }
    }
    return fallback.length > 0 ? fallback : [{ col: 2, row: 2 }];
  }

  private scanAndAttach(): void {
    if (!fs.existsSync(this.claudeProjectDir)) return;
    let files: string[] = [];
    try {
      files = fs
        .readdirSync(this.claudeProjectDir)
        .filter((name) => name.endsWith(".jsonl"))
        .map((name) => path.join(this.claudeProjectDir, name));
    } catch {
      return;
    }

    for (const filePath of files) {
      if (!this.fileStates.has(filePath)) {
        this.attachFile(filePath);
      } else {
        this.readAppend(this.fileStates.get(filePath)!);
      }
    }
  }

  private attachFile(filePath: string): void {
    const sessionId = path.basename(filePath, ".jsonl");
    const agentId = this.ensureAgent(sessionId);
    const state: FileState = {
      filePath,
      sessionId,
      agentId,
      offset: 0,
      lineBuffer: "",
    };
    this.fileStates.set(filePath, state);

    try {
      state.watcher = fs.watch(filePath, () => this.readAppend(state));
    } catch {
      state.watcher = undefined;
    }

    this.readAppend(state);
  }

  private readAppend(fileState: FileState): void {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(fileState.filePath);
    } catch {
      return;
    }

    if (stat.size <= fileState.offset) return;

    const length = stat.size - fileState.offset;
    const buffer = Buffer.alloc(length);
    let fd: number | null = null;

    try {
      fd = fs.openSync(fileState.filePath, "r");
      fs.readSync(fd, buffer, 0, length, fileState.offset);
      fileState.offset = stat.size;
    } catch {
      return;
    } finally {
      if (fd !== null) fs.closeSync(fd);
    }

    const text = fileState.lineBuffer + buffer.toString("utf-8");
    const lines = text.split("\n");
    fileState.lineBuffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      this.processLine(fileState.agentId, line);
    }
  }

  private ensureAgent(sessionId: string): string {
    const existing = this.sessionToAgentId.get(sessionId);
    if (existing) return existing;

    this.agentCounter += 1;
    const agentId = `claude-${sessionId.slice(0, 8)}`;
    this.sessionToAgentId.set(sessionId, agentId);

    const seat = this.seatPool[(this.agentCounter - 1) % this.seatPool.length];
    this.emit("agent.created", agentId, {
      name: `Claude #${this.agentCounter}`,
      seat_id: `seat-${this.agentCounter}`,
      col: seat.col,
      row: seat.row,
    });
    return agentId;
  }

  private processLine(agentId: string, line: string): void {
    let record: Record<string, unknown>;
    try {
      record = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return;
    }

    if (record.type === "assistant") {
      this.handleAssistantRecord(agentId, record);
      return;
    }

    if (record.type === "user") {
      this.handleUserRecord(agentId, record);
      return;
    }

    if (record.type === "progress") {
      this.handleProgressRecord(agentId, record);
      return;
    }

    if (record.type === "system" && record.subtype === "turn_duration") {
      this.emit("agent.status.changed", agentId, { status: "waiting" });
      this.emit("agent.tools.cleared", agentId, {});
      this.activeTools.delete(agentId);
    }
  }

  private handleAssistantRecord(agentId: string, record: Record<string, unknown>): void {
    const message = record.message as Record<string, unknown> | undefined;
    const blocks = Array.isArray(message?.content) ? (message?.content as Array<Record<string, unknown>>) : [];
    const toolUses = blocks.filter((block) => block.type === "tool_use");
    if (toolUses.length === 0) return;

    this.emit("agent.status.changed", agentId, { status: "active" });
    let tools = this.activeTools.get(agentId);
    if (!tools) {
      tools = new Map<string, string>();
      this.activeTools.set(agentId, tools);
    }

    for (const block of toolUses) {
      const toolId = typeof block.id === "string" ? block.id : "";
      const toolName = typeof block.name === "string" ? block.name : "Tool";
      const input = (block.input ?? {}) as Record<string, unknown>;
      if (!toolId) continue;

      if (toolName === "Task") {
        this.taskMetaByToolId.set(toolId, {
          parentAgentId: agentId,
          description: typeof input.description === "string" ? input.description : null,
        });
      }

      const status = formatToolStatus(toolName, input);
      tools.set(toolId, status);
      this.emit("agent.tool.started", agentId, {
        tool_id: toolId,
        tool_name: toolName,
        status,
      });
    }
  }

  private handleUserRecord(agentId: string, record: Record<string, unknown>): void {
    const message = record.message as Record<string, unknown> | undefined;
    const blocks = Array.isArray(message?.content) ? (message?.content as Array<Record<string, unknown>>) : [];
    if (blocks.length === 0) return;

    const tools = this.activeTools.get(agentId);
    for (const block of blocks) {
      if (block.type !== "tool_result") continue;
      const toolId = typeof block.tool_use_id === "string" ? block.tool_use_id : "";
      if (!toolId) continue;
      this.emit("agent.tool.finished", agentId, { tool_id: toolId });
      tools?.delete(toolId);
      this.removeSubagentForTask(toolId);
    }
  }

  private handleProgressRecord(fallbackParentAgentId: string, record: Record<string, unknown>): void {
    const data = record.data as Record<string, unknown> | undefined;
    if (!data || data.type !== "agent_progress") return;

    const parentToolUseID = typeof record.parentToolUseID === "string" ? record.parentToolUseID : "";
    if (!parentToolUseID) return;

    const subRawId = typeof data.agentId === "string" ? data.agentId : "";
    if (!subRawId) return;

    const taskMeta = this.taskMetaByToolId.get(parentToolUseID);
    const parentAgentId = taskMeta?.parentAgentId ?? fallbackParentAgentId;
    const subAgentId = this.ensureSubagent(parentToolUseID, subRawId, parentAgentId, taskMeta?.description ?? null);

    const progressMessage = data.message as Record<string, unknown> | undefined;
    const msgType = typeof progressMessage?.type === "string" ? progressMessage.type : "";
    const innerMessage = progressMessage?.message as Record<string, unknown> | undefined;
    const blocks = Array.isArray(innerMessage?.content) ? (innerMessage.content as Array<Record<string, unknown>>) : [];
    if (blocks.length === 0) return;

    if (msgType === "assistant") {
      this.emit("agent.status.changed", subAgentId, { status: "active" });
      let tools = this.activeTools.get(subAgentId);
      if (!tools) {
        tools = new Map<string, string>();
        this.activeTools.set(subAgentId, tools);
      }

      for (const block of blocks) {
        if (block.type !== "tool_use") continue;
        const toolId = typeof block.id === "string" ? block.id : "";
        const toolName = typeof block.name === "string" ? block.name : "Tool";
        const input = (block.input ?? {}) as Record<string, unknown>;
        if (!toolId) continue;

        const status = formatToolStatus(toolName, input);
        tools.set(toolId, status);
        this.emit("agent.tool.started", subAgentId, {
          tool_id: toolId,
          tool_name: toolName,
          status,
        });
      }
      return;
    }

    if (msgType === "user") {
      const tools = this.activeTools.get(subAgentId);
      for (const block of blocks) {
        if (block.type !== "tool_result") continue;
        const toolId = typeof block.tool_use_id === "string" ? block.tool_use_id : "";
        if (!toolId) continue;
        this.emit("agent.tool.finished", subAgentId, { tool_id: toolId });
        tools?.delete(toolId);
      }
    }
  }

  private ensureSubagent(
    parentToolUseID: string,
    subRawId: string,
    parentAgentId: string,
    description: string | null,
  ): string {
    const existing = this.subAgentByParentToolId.get(parentToolUseID);
    if (existing) return existing;

    const subAgentId = `sub-${subRawId}`;
    this.subAgentByParentToolId.set(parentToolUseID, subAgentId);

    const parent = this.state.agents.find((agent) => agent.agent_id === parentAgentId);
    const baseCol = parent?.position.col ?? 2;
    const baseRow = parent?.position.row ?? 2;
    const offset = this.subAgentByParentToolId.size % 4;
    const position = [
      { col: baseCol + 1, row: baseRow },
      { col: baseCol, row: baseRow + 1 },
      { col: baseCol - 1, row: baseRow },
      { col: baseCol, row: baseRow - 1 },
    ][offset];

    this.emit("agent.subagent.created", subAgentId, {
      name: description ?? `Subagent ${subRawId.slice(0, 6)}`,
      parent_agent_id: parentAgentId,
      col: Math.max(0, Math.min(this.baseSnapshot.layout.cols - 1, position.col)),
      row: Math.max(0, Math.min(this.baseSnapshot.layout.rows - 1, position.row)),
    });

    return subAgentId;
  }

  private removeSubagentForTask(parentToolUseID: string): void {
    const subAgentId = this.subAgentByParentToolId.get(parentToolUseID);
    if (!subAgentId) return;

    this.emit("agent.subagent.removed", subAgentId, {});
    this.activeTools.delete(subAgentId);
    this.subAgentByParentToolId.delete(parentToolUseID);
    this.taskMetaByToolId.delete(parentToolUseID);
  }

  private emit(type: AgentEvent["type"], agentId: string, payload: Record<string, unknown>): void {
    const event: AgentEvent = {
      seq: ++this.seq,
      ts: new Date().toISOString(),
      run_id: "live-run",
      type,
      agent_id: agentId,
      payload,
    };

    this.events.push(event);
    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(this.events.length - MAX_EVENTS);
    }

    this.state = applyEvent(this.state, event);
    this.state.snapshot_ts = event.ts;
    for (const listener of this.listeners) listener(event);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __pixelLiveBridge: LiveAgentBridge | undefined;
}

export function getLiveBridge(): LiveAgentBridge {
  if (!global.__pixelLiveBridge) {
    global.__pixelLiveBridge = new LiveAgentBridge();
    global.__pixelLiveBridge.start();
  }
  return global.__pixelLiveBridge;
}
