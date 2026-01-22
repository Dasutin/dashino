import type { WidgetController } from "../../web/src/types";
import { Chart, type ChartData, type ChartOptions } from "chart.js/auto";

type DonutSegment = {
  label: string;
  value: number;
};

type DonutPayload = {
  at?: string;
  data?: {
    label?: string;
    segments?: DonutSegment[];
  };
};

const PALETTE = ["#38bdf8", "#22c55e", "#fbbf24", "#f97316", "#f43f5e", "#a78bfa"];

function formatAt(at?: string) {
  if (!at) return "";
  const ms = Date.parse(at);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function createChart(ctx: CanvasRenderingContext2D) {
  const data: ChartData<"doughnut"> = {
    labels: [],
    datasets: [
      {
        data: [],
        backgroundColor: PALETTE,
        borderWidth: 0,
        hoverOffset: 8
      }
    ]
  };

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true }
    },
    cutout: "60%"
  };

  return new Chart(ctx, { type: "doughnut", data, options });
}

export function createController({ root }: { root: HTMLElement }): WidgetController {
  const canvas = root.querySelector("canvas");
  const metaEl = root.querySelector<HTMLElement>(".donut-meta");
  const valueEl = root.querySelector<HTMLElement>(".donut-value");
  const labelEl = root.querySelector<HTMLElement>(".donut-label");

  if (!(canvas instanceof HTMLCanvasElement)) return {};
  const ctx = canvas.getContext("2d");
  if (!ctx) return {};

  const chart = createChart(ctx);

  function apply(payload?: DonutPayload) {
    const segments = payload?.data?.segments ?? [];
    const labels = segments.map(s => s.label);
    const values = segments.map(s => s.value);
    chart.data.labels = labels;
    chart.data.datasets[0].data = values;
    chart.update();

    const total = values.reduce((sum, v) => sum + v, 0);
    if (valueEl) valueEl.textContent = total.toFixed(0);
    if (labelEl) labelEl.textContent = payload?.data?.label ?? "Total";
    if (metaEl) metaEl.textContent = formatAt(payload?.at);
  }

  return {
    update(payload?: DonutPayload) {
      apply(payload);
    },
    resize() {
      chart.resize();
    },
    destroy() {
      chart.destroy();
    }
  };
}

export default createController;