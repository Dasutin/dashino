import type { WidgetController } from "../../web/src/types";

type SparkPayload = {
  data?: {
    value?: number;
  };
};

const MAX_POINTS = 40;

export function createController({ root }: { root: HTMLElement }): WidgetController {
  const valueEl = root.querySelector<HTMLElement>(".spark-value");
  const deltaEl = root.querySelector<HTMLElement>(".spark-delta");
  const line = root.querySelector<SVGPolylineElement>(".spark-line");

  const values: number[] = [];

  function render() {
    if (!line || values.length === 0) return;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const pts = values.map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * 120;
      const y = 40 - ((v - min) / span) * 40;
      return `${x},${y}`;
    });
    line.setAttribute("points", pts.join(" "));
  }

  return {
    update(payload?: SparkPayload) {
      const v = Number(payload?.data?.value ?? 0);
      const prev = values[values.length - 1];
      values.push(v);
      if (values.length > MAX_POINTS) values.shift();
      if (valueEl) valueEl.textContent = v.toFixed(1);
      if (deltaEl && prev !== undefined) {
        const delta = v - prev;
        const sign = delta >= 0 ? "+" : "";
        deltaEl.textContent = `${sign}${delta.toFixed(1)}`;
      }
      render();
    },
    resize() {
      render();
    },
    destroy() {}
  };
}

export default createController;
