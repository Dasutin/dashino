import type { WidgetController } from "../../web/src/types";

type StatusPayload = {
  at?: string;
  data?: {
    state?: "ok" | "warn" | "error";
    message?: string;
    detail?: string;
  };
};

const STATE_CLASSES = {
  ok: "status-ok",
  warn: "status-warn",
  error: "status-error"
};

function formatAt(at?: string) {
  if (!at) return "";
  const ms = Date.parse(at);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

export function createController({ root }: { root: HTMLElement }): WidgetController {
  const stateEl = root.querySelector<HTMLElement>(".status-state");
  const msgEl = root.querySelector<HTMLElement>(".status-message");
  const metaEl = root.querySelector<HTMLElement>(".status-meta");

  return {
    update(payload?: StatusPayload) {
      const state = payload?.data?.state ?? "ok";
      const message = payload?.data?.message ?? payload?.data?.detail ?? "";
      const atText = formatAt(payload?.at);

      root.classList.remove(STATE_CLASSES.ok, STATE_CLASSES.warn, STATE_CLASSES.error);
      root.classList.add(STATE_CLASSES[state] ?? STATE_CLASSES.ok);

      if (stateEl) stateEl.textContent = state.toUpperCase();
      if (msgEl) msgEl.textContent = message;
      if (metaEl) metaEl.textContent = atText;
    },
    resize() {},
    destroy() {}
  };
}

export default createController;
