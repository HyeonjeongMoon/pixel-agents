import { NextRequest, NextResponse } from "next/server";
import { clearSourceLogs, resolveDataSource } from "@/lib/dataSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE /api/v1/logs — delete all JSONL session files and reset live state. */
export async function DELETE(request: NextRequest) {
  const source = resolveDataSource(request.nextUrl.searchParams.get("source") ?? "claude");
  if (source === "mock") {
    return NextResponse.json({ deleted: 0, message: "mock source — nothing to delete" });
  }

  const deleted = clearSourceLogs(source);
  return NextResponse.json({ deleted, source });
}
