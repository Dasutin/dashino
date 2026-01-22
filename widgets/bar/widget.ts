import type { WidgetController } from "../../web/src/types";
import { Chart, type ChartData, type ChartOptions } from "chart.js/auto";

type BarPayload = {
  at?: string;
  data?: {
    labels?: string[];
    values?: number[];
    label?: string;
  };
};

function formatAt(at?: string) {
  if (!at) return "";
  const ms = Date.parse(at);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function createChart(ctx: CanvasRenderingContext2D) {
  const data: ChartData<"bar"> = {
    labels: [],
    datasets: [
      {
        label: "Values",
        data: [],
        backgroundColor: "rgba(56, 189, 248, 0.6)",
        borderRadius: 6,
        borderSkipped: false
      }
    ]
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: "rgba(148, 163, 184, 0.15)" } }
    },
    plugins: { legend: { display: false }, tooltip: { enabled: true } }
  };

  return new Chart(ctx, { type: "bar", data, options });
}

export function createController({ root }: { root: HTMLElement }): WidgetController {
  const canvas = root.querySelector("canvas");
  const metaEl = root.querySelector<HTMLElement>(".bar-meta");

  if (!(canvas instanceof HTMLCanvasElement)) return {};
  const ctx = canvas.getContext("2d");
  if (!ctx) return {};

  const chart = createChart(ctx);

  function apply(payload?: BarPayload) {
    const labels = payload?.data?.labels ?? [];
    const values = payload?.data?.values ?? [];
    chart.data.labels = labels;
    chart.data.datasets[0].data = values;
    chart.update();
    if (metaEl) metaEl.textContent = formatAt(payload?.at);
  }

  return {
    update(payload?: BarPayload) {
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