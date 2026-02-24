import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createRpcRequester, postRpcNotification } from "./bridge";
import { useBridgeLifecycle, useOpenAiGlobal, useToolResult } from "./hooks";
import type { TaskItem } from "./types";

const rpcRequest = createRpcRequester();

function statusLabel(status: TaskItem["status"]): string {
  if (status === "in_progress") return "In progress";
  if (status === "done") return "Done";
  return "To do";
}

function App() {
  const toolResult = useToolResult();
  const openAiOutput = useOpenAiGlobal("toolOutput");
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useBridgeLifecycle(() => {
    setLog((prev) => [...prev, "Bridge connected."]);
  });

  const structured = toolResult?.structuredContent ?? openAiOutput ?? { title: "Task board", tasks: [] };
  const tasks = useMemo(() => (structured?.tasks ?? []) as TaskItem[], [structured]);

  const handleCallTool = async () => {
    try {
      setLoading(true);
      const response = await rpcRequest<{ structuredContent?: { tasks?: TaskItem[] } }>("tools/call", {
        name: "shuffle_tasks",
        arguments: { source: "widget" },
      });

      const count = response?.structuredContent?.tasks?.length ?? 0;
      setLog((prev) => [...prev, `tools/call success: ${count} tasks`]);
    } catch (error) {
      setLog((prev) => [...prev, `tools/call failed: ${(error as Error).message}`]);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUp = () => {
    postRpcNotification("ui/message", {
      role: "user",
      content: [{ type: "text", text: "우선순위 기준으로 다음 액션을 정리해줘." }],
    });
    setLog((prev) => [...prev, "ui/message sent"]);
  };

  const handleUpdateContext = async () => {
    try {
      await rpcRequest("ui/update-model-context", {
        content: [{ type: "text", text: `User reviewed ${tasks.length} tasks in widget.` }],
      });
      setLog((prev) => [...prev, "ui/update-model-context success"]);
    } catch (error) {
      setLog((prev) => [...prev, `context update failed: ${(error as Error).message}`]);
    }
  };

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 14, color: "#15212a" }}>
      <h2 style={{ marginTop: 0, marginBottom: 8 }}>{structured?.title ?? "Task board"}</h2>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#415766" }}>
        JSON-RPC bridge demo (`ui/notifications/tool-result`, `tools/call`, `ui/message`, `ui/update-model-context`)
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={handleCallTool} disabled={loading}>Call tools/call</button>
        <button onClick={handleFollowUp}>Send ui/message</button>
        <button onClick={handleUpdateContext}>Update model context</button>
      </div>

      <section style={{ border: "1px solid #c8d4dc", borderRadius: 8, padding: 10, marginBottom: 12 }}>
        <strong style={{ display: "block", marginBottom: 8 }}>Tasks</strong>
        {tasks.length === 0 ? <p style={{ margin: 0 }}>No tasks from tool result yet.</p> : null}
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          {tasks.map((task) => (
            <li key={task.id}>
              <span style={{ fontWeight: 600 }}>{task.title}</span>
              <span style={{ marginLeft: 8, fontSize: 12, color: "#4f6573" }}>
                {statusLabel(task.status)}{task.owner ? ` · ${task.owner}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ border: "1px solid #c8d4dc", borderRadius: 8, padding: 10 }}>
        <strong style={{ display: "block", marginBottom: 8 }}>Event log</strong>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: 12 }}>
          {log.length === 0 ? <li>No events yet.</li> : log.slice(-8).map((item, idx) => <li key={`${idx}-${item}`}>{item}</li>)}
        </ul>
      </section>
    </main>
  );
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Missing #root element");
}

createRoot(rootEl).render(<App />);
