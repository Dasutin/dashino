import type { WidgetController } from "../../web/src/types";

type CountdownPayload = {
  data?: {
    target?: string;
    label?: string;
    mode?: "until" | "since";
  };
};

function formatDiff(ms: number) {
  const abs = Math.abs(ms);
  const totalSeconds = Math.floor(abs / 1000);
  const h = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function createController({ root }: { root: HTMLElement }): WidgetController {
  const valueEl = root.querySelector<HTMLElement>(".countdown-value");
  const labelEl = root.querySelector<HTMLElement>(".countdown-label");

  let targetMs = Date.now();
  let mode: "until" | "since" = "until";
  let timer: number | null = null;

  function tick() {
    const now = Date.now();
    const diff = mode === "since" ? now - targetMs : targetMs - now;
    if (valueEl) valueEl.textContent = formatDiff(diff);
  }

  function start() {
    if (timer !== null) return;
    timer = window.setInterval(tick, 1000);
    tick();
  }

  function stop() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    update(payload?: CountdownPayload) {
      const t = payload?.data?.target;
      if (t) {
        const ms = Date.parse(t);
        if (Number.isFinite(ms)) targetMs = ms;
      }
      mode = payload?.data?.mode === "since" ? "since" : "until";
      if (labelEl) labelEl.textContent = payload?.data?.label ?? "";
      start();
    },
    resize() {},
    destroy() {
      stop();
    }
  };
}

export default createController;
