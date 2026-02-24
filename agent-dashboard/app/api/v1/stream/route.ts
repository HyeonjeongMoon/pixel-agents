import { loadEvents } from "@/lib/mockStore";

export async function GET() {
  const events = loadEvents();
  const encoder = new TextEncoder();
  let index = 0;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(": stream-start\n\n"));

      const timer = setInterval(() => {
        if (index >= events.length) {
          controller.enqueue(encoder.encode("event: end\ndata: {}\n\n"));
          clearInterval(timer);
          controller.close();
          return;
        }

        const payload = JSON.stringify(events[index]);
        controller.enqueue(encoder.encode(`event: message\ndata: ${payload}\n\n`));
        index += 1;
      }, 1200);
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
