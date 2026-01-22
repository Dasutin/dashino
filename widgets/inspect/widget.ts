import type { WidgetController } from "../../web/src/types";

type InspectPayload = {
  at?: string;
  data?: unknown;
};

function formatAt(at?: string) {
  if (!at) return "";
  const ms = Date.parse(at);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function stringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value ?? "");
  }
}

export function createController({ root }: { root: HTMLElement }): WidgetController {
  const metaEl = root.querySelector<HTMLElement>(".inspect-meta");
  const bodyEl = root.querySelector<HTMLElement>(".inspect-body");

  return {
    update(payload?: InspectPayload) {
      if (!bodyEl) return;
      if (metaEl) metaEl.textContent = formatAt(payload?.at);
      const content = payload?.data ?? payload ?? {};
      bodyEl.textContent = stringify(content);
    },
    resize() {},
    destroy() {}
  };
}

export default createController;