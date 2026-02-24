import { useEffect, useRef } from "react";
import type { RpcIncoming, RpcRequest } from "./types";

export function isJsonRpcMessage(input: unknown): input is RpcIncoming {
  if (!input || typeof input !== "object") return false;
  const value = input as Record<string, unknown>;
  return value.jsonrpc === "2.0" && typeof value.method === "string" || value.jsonrpc === "2.0" && typeof value.id === "number";
}

export function postRpcNotification(method: string, params?: unknown): void {
  window.parent.postMessage({ jsonrpc: "2.0", method, params }, "*");
}

export function createRpcRequester() {
  let nextId = 1;
  return function rpcRequest<T = unknown>(method: string, params?: unknown, timeoutMs = 5000): Promise<T> {
    const id = nextId++;
    const request: RpcRequest = { jsonrpc: "2.0", id, method, params };

    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error(`RPC timeout: ${method}`));
      }, timeoutMs);

      const onMessage = (event: MessageEvent) => {
        if (event.source !== window.parent) return;
        const message = event.data as RpcIncoming;
        if (!message || message.jsonrpc !== "2.0" || message.id !== id) return;

        cleanup();

        if ("error" in message) {
          reject(new Error(message.error.message));
          return;
        }

        resolve((message.result ?? null) as T);
      };

      const cleanup = () => {
        window.clearTimeout(timer);
        window.removeEventListener("message", onMessage);
      };

      window.addEventListener("message", onMessage, { passive: true });
      window.parent.postMessage(request, "*");
    });
  };
}

export function useParentJsonRpc(handler: (message: RpcIncoming) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      const message = event.data as RpcIncoming;
      if (!isJsonRpcMessage(message)) return;
      handlerRef.current(message);
    };

    window.addEventListener("message", onMessage, { passive: true });
    return () => window.removeEventListener("message", onMessage);
  }, []);
}
