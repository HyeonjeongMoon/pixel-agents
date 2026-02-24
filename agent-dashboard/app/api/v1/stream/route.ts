import { NextRequest } from "next/server";
import { getDataSource, loadAgentEvents } from "@/lib/dataSource";
import { getLiveBridge } from "@/lib/liveBridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const source = getDataSource();
  if (source === "live") {
    return streamLive(request);
  }
  return streamMock();
}

function streamMock() {
  const events = loadAgentEvents(0);
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

        const payload = JSON.stringify(events[index]);
        controller.enqueue(encoder.encode(`event: message\ndata: ${payload}\n\n`));
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

function streamLive(request: NextRequest) {
  const encoder = new TextEncoder();
  const bridge = getLiveBridge();
  const rawAfterSeq = Number(request.nextUrl.searchParams.get("after_seq") ?? "0");
  const afterSeq = Number.isFinite(rawAfterSeq) && rawAfterSeq > 0 ? rawAfterSeq : 0;
  let unsubscribe: (() => void) | null = null;
  let heartbeat: NodeJS.Timeout | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(": stream-start\n\n"));

      const backlog = bridge.listEvents(afterSeq);
      for (const event of backlog) {
        controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(event)}\n\n`));
      }

      unsubscribe = bridge.subscribe((event) => {
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
