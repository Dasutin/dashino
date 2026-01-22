import type { WidgetController } from "../../web/src/types";

type TextPayload = {
  data?: {
    title?: string;
    text?: string;
  };
};

export function createController({ root }: { root: HTMLElement }): WidgetController {
  const titleEl = root.querySelector<HTMLElement>(".text-title");
  const bodyEl = root.querySelector<HTMLElement>(".text-body");

  return {
    update(payload?: TextPayload) {
      if (titleEl && payload?.data?.title) titleEl.textContent = payload.data.title;
      if (bodyEl) bodyEl.textContent = payload?.data?.text ?? "";
    },
    resize() {},
    destroy() {}
  };
}

export default createController;
