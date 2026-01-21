import type { WidgetController } from "../../web/src/types";
import { Chart, type ChartData, type ChartOptions } from "chart.js/auto";

type GraphPayload = {
  value?: number;
  label?: string;
  at?: string;
  data?: {
    value?: number;
    label?: string;
  };
};

const MAX_POINTS = 30;
const FALLBACK_WIDTH = 300;
const FALLBACK_HEIGHT = 180;

function sizeCanvas(canvas: HTMLCanvasElement, host: HTMLElement) {
  const rect = host.getBoundingClientRect();
  const w = rect.width > 0 ? rect.width : FALLBACK_WIDTH;
  const h = rect.height > 0 ? rect.height : FALLBACK_HEIGHT;
  // Set both canvas buffer size and rendered size to avoid collapse when host is 0px tall.
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
}

function createChart(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, host: HTMLElement) {
  sizeCanvas(canvas, host);

  const data: ChartData<"line"> = {
    labels: [],
    datasets: [
      {
        label: "Value",
        data: [],
        borderColor: "#38bdf8",
        backgroundColor: "rgba(56, 189, 248, 0.15)",
        tension: 0.3,
        fill: true,
        borderWidth: 2,
        pointRadius: 2
      }
    ]
  };

  const options: ChartOptions<"line"> = {
    responsive: false,
    maintainAspectRatio: false,
    scales: {
      x: {
        reverse: true,
        ticks: { maxTicksLimit: 6 },
        grid: { color: "rgba(148, 163, 184, 0.15)" }
      },
      y: {
        min: 0,
        max: 100,
        ticks: { maxTicksLimit: 5 },
        grid: { color: "rgba(148, 163, 184, 0.1)" },
        title: { display: true, text: "Value (0-100)" }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true }
    }
  };

  return new Chart(ctx, {
    type: "line",
    data,
    options
  });
}

function pushPoint(chart: Chart<"line">, payload?: GraphPayload) {
  if (!payload) return;

  const dataField = (payload as any)?.data ?? payload;
  const rawValue = (dataField as any)?.value ?? (payload as any)?.value;
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return;

  const label = (dataField as any)?.label || payload.at || new Date().toLocaleTimeString();
  const ds = chart.data.datasets[0];
  const labels = chart.data.labels as string[];

  labels.push(label);
  (ds.data as number[]).push(value);

  if (labels.length > MAX_POINTS) {
    labels.shift();
    (ds.data as number[]).shift();
  }

  chart.update();
}

export function createController({ root }: { root: HTMLElement }): WidgetController {
  const canvas = root.querySelector("canvas");
  if (!(canvas instanceof HTMLCanvasElement)) {
    return {};
  }

  const host = canvas.parentElement ?? root;
  const ctx = canvas.getContext("2d");
  if (!ctx) return {};

  const chart = createChart(canvas, ctx, host as HTMLElement);

  return {
    update(payload?: any) {
      // Re-size canvas to host before drawing, to avoid collapse on updates.
      sizeCanvas(canvas, host as HTMLElement);
      pushPoint(chart, payload as GraphPayload);
    },
    destroy() {
      chart.destroy();
    }
  };
}

export default createController;
