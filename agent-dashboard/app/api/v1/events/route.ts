import { NextRequest, NextResponse } from "next/server";
import { loadAgentEvents } from "@/lib/dataSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rawAfterSeq = Number(request.nextUrl.searchParams.get("after_seq") ?? "0");
  const afterSeq = Number.isFinite(rawAfterSeq) && rawAfterSeq > 0 ? rawAfterSeq : 0;
  const events = loadAgentEvents(afterSeq);

  return NextResponse.json(events);
}
