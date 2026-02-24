import { NextResponse } from "next/server";
import { loadStateSnapshot } from "@/lib/dataSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = loadStateSnapshot();
  return NextResponse.json({
    run_id: snapshot.run_id,
    layout: snapshot.layout,
  });
}
