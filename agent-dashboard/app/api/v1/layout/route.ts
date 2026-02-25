import { NextRequest, NextResponse } from "next/server";
import { loadStateSnapshot, resolveDataSource } from "@/lib/dataSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const source = resolveDataSource(request.nextUrl.searchParams.get("source"));
  const snapshot = loadStateSnapshot(source);
  return NextResponse.json({
    run_id: snapshot.run_id,
    layout: snapshot.layout,
  });
}
