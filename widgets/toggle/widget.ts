import type { WidgetController } from "../../web/src/types";

type TogglePayload = {
  data?: {
    state?: boolean | string;
    detail?: string;
  };
};

function normalizeState(state?: boolean | string) {
  if (typeof state === "boolean") return state;
  if (typeof state === "string") return state.toLowerCase() === "on" || state.toLowerCase() === "true";
  return false;
}

export function createController({ root }: { root: HTMLElement }): WidgetController {
  const switchEl = root.querySelector<HTMLElement>(".toggle-switch");
  const detailEl = root.querySelector<HTMLElement>(".toggle-detail");
  const stateEl = root.querySelector<HTMLElement>(".toggle-state");

  return {
    update(payload?: TogglePayload) {
      const on = normalizeState(payload?.data?.state);
      if (switchEl) switchEl.classList.toggle("on", on);
      if (stateEl) stateEl.textContent = on ? "ON" : "OFF";
      if (detailEl) detailEl.textContent = payload?.data?.detail ?? "";
    },
    resize() {},
    destroy() {}
  };
}

export default createController;