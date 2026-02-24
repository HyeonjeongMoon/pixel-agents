import { NextResponse } from "next/server";
import { loadSnapshot } from "@/lib/mockStore";

export async function GET() {
  return NextResponse.json(loadSnapshot());
}
