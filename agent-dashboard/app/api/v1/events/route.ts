import { NextRequest, NextResponse } from "next/server";
import { loadEvents } from "@/lib/mockStore";

export async function GET(request: NextRequest) {
  const events = loadEvents();
  const afterSeq = Number(request.nextUrl.searchParams.get("after_seq") ?? "0");

  if (Number.isNaN(afterSeq) || afterSeq <= 0) {
    return NextResponse.json(events);
  }

  return NextResponse.json(events.filter((event) => event.seq > afterSeq));
}
