import { useEffect, useState, useSyncExternalStore } from "react";
import { useParentJsonRpc } from "./bridge";
import type { OpenAiGlobals, ToolResultPayload } from "./types";

const SET_GLOBALS_EVENT_TYPE = "openai:set_globals";

export function useToolResult(): ToolResultPayload | null {
  const [toolResult, setToolResult] = useState<ToolResultPayload | null>(null);

  useParentJsonRpc((message) => {
    if (!("method" in message)) return;
    if (message.method !== "ui/notifications/tool-result") return;
    setToolResult((message.params ?? null) as ToolResultPayload | null);
  });

  return toolResult;
}

export function useOpenAiGlobal<K extends keyof OpenAiGlobals>(key: K): OpenAiGlobals[K] {
  return useSyncExternalStore(
    (onChange) => {
      const listener = (event: Event) => {
        const custom = event as CustomEvent<{ globals: OpenAiGlobals }>;
        const globals = custom.detail?.globals;
        if (!globals || globals[key] === undefined) return;
        onChange();
      };
      window.addEventListener(SET_GLOBALS_EVENT_TYPE, listener, { passive: true });
      return () => window.removeEventListener(SET_GLOBALS_EVENT_TYPE, listener);
    },
    () => ((window as Window & { openai?: OpenAiGlobals }).openai?.[key] as OpenAiGlobals[K])
  );
}

export function useBridgeLifecycle(onReady?: () => void): void {
  useEffect(() => {
    onReady?.();
  }, [onReady]);
}
