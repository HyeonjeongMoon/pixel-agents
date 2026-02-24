import { NextResponse } from "next/server";
import { loadSnapshot } from "@/lib/mockStore";

export async function GET() {
  const snapshot = loadSnapshot();
  return NextResponse.json({
    run_id: snapshot.run_id,
    layout: snapshot.layout,
  });
}
