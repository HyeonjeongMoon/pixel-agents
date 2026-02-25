import { NextRequest } from "next/server";
import { loadAgentEvents, resolveDataSource, subscribeToEvents } from "@/lib/dataSource";
import type { DashboardDataSource } from "@/lib/dataSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const source = resolveDataSource(request.nextUrl.searchParams.get("source"));
  if (source === "mock") {
    return streamMock();
  }
  return streamRealtime(source, request);
}

function streamMock() {
  const events = loadAgentEvents("mock", 0);
  const encoder = new TextEncoder();
  let index = 0;
  let timer: NodeJS.Timeout | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(": stream-start\n\n"));

      timer = setInterval(() => {
        if (index >= events.length) {
          controller.enqueue(encoder.encode("event: end\ndata: {}\n\n"));
          if (timer) clearInterval(timer);
          controller.close();
          return;
        }

        controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(events[index])}\n\n`));
        index += 1;
      }, 1200);
    },
    cancel() {
      if (timer) clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function streamRealtime(source: DashboardDataSource, request: NextRequest) {
  const encoder = new TextEncoder();
  const rawAfterSeq = Number(request.nextUrl.searchParams.get("after_seq") ?? "0");
  const afterSeq = Number.isFinite(rawAfterSeq) && rawAfterSeq > 0 ? rawAfterSeq : 0;
  let unsubscribe: (() => void) | null = null;
  let heartbeat: NodeJS.Timeout | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(": stream-start\n\n"));

      const backlog = loadAgentEvents(source, afterSeq);
      for (const event of backlog) {
        controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(event)}\n\n`));
      }

      unsubscribe = subscribeToEvents(source, (event) => {
        controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(event)}\n\n`));
      });

      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 15_000);
    },
    cancel() {
      if (unsubscribe) unsubscribe();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
