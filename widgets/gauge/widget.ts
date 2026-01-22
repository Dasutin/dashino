import type { WidgetController } from "../../web/src/types";

type GaugePayload = {
  data?: {
    value?: number;
    min?: number;
    max?: number;
    label?: string;
    unit?: string;
  };
};

const DASH_MAX = 157; // arc length for 120-70 semi circle path

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function colorFor(value: number) {
  if (value > 90) return "#ef4444";
  if (value > 80) return "#fb923c";
  if (value > 60) return "#fbbf24";
  return "#22c55e";
}

export function createController({ root }: { root: HTMLElement }): WidgetController {
  const fill = root.querySelector<SVGPathElement>(".gauge-fill");
  const dot = root.querySelector<SVGCircleElement>(".gauge-dot");
  const valueEl = root.querySelector<HTMLElement>(".gauge-value");
  const labelEl = root.querySelector<HTMLElement>(".gauge-label");

  return {
    update(payload?: GaugePayload) {
      const val = Number(payload?.data?.value ?? 0);
      const min = Number.isFinite(payload?.data?.min) ? Number(payload!.data!.min) : 0;
      const max = Number.isFinite(payload?.data?.max) ? Number(payload!.data!.max) : 100;
      const pct = clamp((val - min) / (max - min || 1), 0, 1);
      const dash = DASH_MAX - DASH_MAX * pct;
      const color = colorFor(val);

      if (fill) {
        fill.style.strokeDashoffset = `${dash}`;
        fill.style.stroke = color;
      }
      if (dot) {
        const angle = Math.PI * (1 - pct);
        const radius = 50;
        const cx = 60 + radius * Math.cos(angle);
        const cy = 70 - radius * Math.sin(angle);
        dot.setAttribute("cx", `${cx}`);
        dot.setAttribute("cy", `${cy}`);
        dot.style.fill = color;
      }

      if (valueEl) {
        const unit = payload?.data?.unit ?? "";
        valueEl.textContent = `${val.toFixed(0)}${unit}`;
      }
      if (labelEl) {
        labelEl.textContent = payload?.data?.label ?? "";
      }
    },
    resize() {},
    destroy() {}
  };
}

export default createController;
