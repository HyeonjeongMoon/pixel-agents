import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/dataSource";
import { getLiveBridge } from "@/lib/liveBridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE /api/v1/logs — delete all JSONL session files and reset live state. */
export async function DELETE() {
  if (getDataSource() !== "live") {
    return NextResponse.json({ deleted: 0, message: "mock mode — nothing to delete" });
  }

  const deleted = getLiveBridge().clearLogs();
  return NextResponse.json({ deleted });
}
