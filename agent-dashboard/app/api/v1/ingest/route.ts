import { NextRequest, NextResponse } from "next/server";
import { ingestGenericEvents } from "@/lib/dataSource";
import type { EventType, IngestEventInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_EVENT_TYPES = new Set<EventType>([
  "agent.created",
  "agent.status.changed",
  "agent.tool.started",
  "agent.tool.finished",
  "agent.permission.waiting",
  "agent.permission.cleared",
  "agent.position.changed",
  "agent.seat.assigned",
  "agent.subagent.created",
  "agent.subagent.removed",
  "agent.tools.cleared",
  "agent.removed",
  "layout.updated",
]);

function validateOne(input: unknown): input is IngestEventInput {
  if (!input || typeof input !== "object") return false;
  const item = input as Record<string, unknown>;
  if (typeof item.type !== "string" || !VALID_EVENT_TYPES.has(item.type as EventType)) return false;
  if (typeof item.agent_id !== "string" || item.agent_id.length === 0) return false;
  if (!item.payload || typeof item.payload !== "object" || Array.isArray(item.payload)) return false;
  return true;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const rawItems = Array.isArray(body) ? body : [body];
  if (rawItems.length === 0) {
    return NextResponse.json({ error: "empty payload" }, { status: 400 });
  }

  const items: IngestEventInput[] = [];
  for (let i = 0; i < rawItems.length; i += 1) {
    if (!validateOne(rawItems[i])) {
      return NextResponse.json({ error: `invalid event at index ${i}` }, { status: 400 });
    }
    items.push(rawItems[i] as IngestEventInput);
  }

  const appended = ingestGenericEvents(items);
  return NextResponse.json({
    accepted: appended.length,
    last_seq: appended.at(-1)?.seq ?? null,
    run_id: appended.at(-1)?.run_id ?? null,
  });
}
