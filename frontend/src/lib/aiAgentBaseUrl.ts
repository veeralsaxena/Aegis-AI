/**
 * AI sidecar URLs.
 *
 * Default: requests go through Next.js at `/ai-service/*`, which rewrites to the
 * FastAPI process (see `next.config.ts` + `start.sh`). Set `NEXT_PUBLIC_AI_AGENT_URL`
 * to a full URL (e.g. http://localhost:8001) only if you run the UI without the proxy.
 */

export const AI_SERVICE_PREFIX = "/ai-service";

function useSameOriginProxy(): boolean {
  const v = process.env.NEXT_PUBLIC_AI_AGENT_URL;
  return v === undefined || v === "" || v === "same-origin";
}

/** HTTP URL for a path like `/api/alerts/...` (browser or server). */
export function aiFetchUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined") {
    if (useSameOriginProxy()) {
      return `${AI_SERVICE_PREFIX}${p}`;
    }
    return `${(process.env.NEXT_PUBLIC_AI_AGENT_URL || "").replace(/\/$/, "")}${p}`;
  }
  const internal =
    process.env.AI_AGENTS_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_AI_AGENT_URL ||
    "http://127.0.0.1:8001";
  if (useSameOriginProxy() || !process.env.NEXT_PUBLIC_AI_AGENT_URL) {
    return `${internal.replace(/\/$/, "")}${p}`;
  }
  return `${(process.env.NEXT_PUBLIC_AI_AGENT_URL || internal).replace(/\/$/, "")}${p}`;
}

/** WebSocket URL for a path like `/api/alerts/ws/uuid`. */
export function aiWsUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined") {
    if (useSameOriginProxy()) {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      return `${proto}://${window.location.host}${AI_SERVICE_PREFIX}${p}`;
    }
    const base = (process.env.NEXT_PUBLIC_AI_AGENT_URL || "").replace(/\/$/, "");
    return `${base.replace(/^http/, "ws")}${p}`;
  }
  const internal = (process.env.AI_AGENTS_INTERNAL_URL || "http://127.0.0.1:8001").replace(
    /\/$/,
    ""
  );
  return `${internal.replace(/^http/, "ws")}${p}`;
}

/** @deprecated use aiFetchUrl */
export function getAiAgentBaseUrl(): string {
  if (typeof window !== "undefined" && useSameOriginProxy()) {
    return AI_SERVICE_PREFIX;
  }
  return (
    process.env.NEXT_PUBLIC_AI_AGENT_URL ||
    process.env.AI_AGENTS_INTERNAL_URL ||
    "http://127.0.0.1:8001"
  ).replace(/\/$/, "");
}

/** @deprecated use aiWsUrl */
export function getAiAgentWsBaseUrl(): string {
  if (typeof window !== "undefined" && useSameOriginProxy()) {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.host}${AI_SERVICE_PREFIX}`;
  }
  return getAiAgentBaseUrl().replace(/^http/, "ws");
}
