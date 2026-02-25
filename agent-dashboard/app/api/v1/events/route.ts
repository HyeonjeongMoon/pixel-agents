import { NextRequest, NextResponse } from "next/server";
import { loadAgentEvents, resolveDataSource } from "@/lib/dataSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rawAfterSeq = Number(request.nextUrl.searchParams.get("after_seq") ?? "0");
  const afterSeq = Number.isFinite(rawAfterSeq) && rawAfterSeq > 0 ? rawAfterSeq : 0;
  const source = resolveDataSource(request.nextUrl.searchParams.get("source"));
  const events = loadAgentEvents(source, afterSeq);

  return NextResponse.json(events);
}
