import { NextResponse } from "next/server";
import { loadStateSnapshot } from "@/lib/dataSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(loadStateSnapshot());
}
