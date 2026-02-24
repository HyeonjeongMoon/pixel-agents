const widget = document.getElementById("widget");
const logEl = document.getElementById("log");

let nextId = 100;

function log(line) {
  const ts = new Date().toISOString().slice(11, 19);
  logEl.textContent += `[${ts}] ${line}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function postToWidget(message) {
  const frameWindow = widget.contentWindow;
  if (!frameWindow) return;
  frameWindow.postMessage(message, "*");
}

function sampleTasks() {
  return [
    { id: "t1", title: "Bridge message parser 정리", status: "in_progress", owner: "프론트" },
    { id: "t2", title: "tools/call 응답 스키마 점검", status: "todo", owner: "백엔드" },
    { id: "t3", title: "ui/message follow-up 문구 개선", status: "done", owner: "기획" }
  ];
}

document.getElementById("sendResult").addEventListener("click", () => {
  const msg = {
    jsonrpc: "2.0",
    method: "ui/notifications/tool-result",
    params: {
      content: [{ type: "text", text: "Tool completed" }],
      structuredContent: {
        title: "MCP Task Board",
        tasks: sampleTasks(),
      },
    },
  };
  postToWidget(msg);
  log("-> ui/notifications/tool-result");
});

document.getElementById("sendInput").addEventListener("click", () => {
  const msg = {
    jsonrpc: "2.0",
    method: "ui/notifications/tool-input",
    params: {
      structuredContent: {
        source: "host-simulator",
        tasks: sampleTasks().map((t) => ({ ...t, status: "todo" })),
      },
    },
  };
  postToWidget(msg);
  log("-> ui/notifications/tool-input");
});

document.getElementById("setGlobals").addEventListener("click", () => {
  const frameWindow = widget.contentWindow;
  if (!frameWindow) return;

  frameWindow.openai = {
    toolOutput: {
      title: "openai:set_globals payload",
      tasks: [
        { id: "g1", title: "globals 기반 렌더링", status: "in_progress", owner: "host" },
      ],
    },
  };

  const event = new CustomEvent("openai:set_globals", {
    detail: {
      globals: frameWindow.openai,
    },
  });

  frameWindow.dispatchEvent(event);
  log("-> openai:set_globals dispatched");
});

window.addEventListener("message", (event) => {
  if (event.source !== widget.contentWindow) return;
  const message = event.data;
  if (!message || message.jsonrpc !== "2.0") return;

  if (typeof message.method === "string") {
    log(`<-${message.method}`);

    if (message.method === "tools/call") {
      const id = message.id ?? nextId++;
      const result = {
        structuredContent: {
          title: "tools/call result",
          tasks: [
            { id: "r1", title: "호스트가 생성한 작업 A", status: "todo", owner: "host" },
            { id: "r2", title: "호스트가 생성한 작업 B", status: "in_progress", owner: "host" },
            { id: "r3", title: "호스트가 생성한 작업 C", status: "done", owner: "host" },
          ],
        },
      };
      postToWidget({ jsonrpc: "2.0", id, result });
      log(`-> tools/call response id=${id}`);
      return;
    }

    if (message.method === "ui/update-model-context") {
      const id = message.id ?? nextId++;
      postToWidget({ jsonrpc: "2.0", id, result: { ok: true } });
      log(`-> ui/update-model-context ack id=${id}`);
      return;
    }

    if (message.method === "ui/message") {
      log(`model message: ${JSON.stringify(message.params)}`);
      return;
    }
  }
});

log("Host simulator ready.");
