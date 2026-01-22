import type { WidgetController } from "../../web/src/types";

type ProgressPayload = {
  data?: {
    value?: number;
    max?: number;
    label?: string;
    state?: string;
  };
};

export function createController({ root }: { root: HTMLElement }): WidgetController {
  const fill = root.querySelector<HTMLElement>(".progress-fill");
  const valueEl = root.querySelector<HTMLElement>(".progress-value");
  const labelEl = root.querySelector<HTMLElement>(".progress-label");
  const stateEl = root.querySelector<HTMLElement>(".progress-state");

  return {
    update(payload?: ProgressPayload) {
      const val = Number(payload?.data?.value ?? 0);
      const max = Number(payload?.data?.max ?? 100) || 100;
      const pct = Math.max(0, Math.min(1, val / max));
      if (fill) fill.style.width = `${(pct * 100).toFixed(1)}%`;
      if (valueEl) valueEl.textContent = `${(pct * 100).toFixed(0)}%`;
      if (labelEl) labelEl.textContent = payload?.data?.label ?? "";
      if (stateEl) stateEl.textContent = payload?.data?.state ?? "";
    },
    resize() {},
    destroy() {}
  };
}

export default createController;
