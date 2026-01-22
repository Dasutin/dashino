import type { WidgetController } from "../../web/src/types";

type FramePayload = {
  data?: {
    url?: string;
    sandbox?: string;
  };
};

type WidgetConfig = {
  url?: string;
  sandbox?: string;
};

export function createController({ root, widget }: { root: HTMLElement; widget: any }): WidgetController {
  const iframe = root.querySelector<HTMLIFrameElement>(".frame-embed");
  const config: WidgetConfig | undefined = (widget as any)?.config;

  function apply(payload?: FramePayload) {
    if (!iframe) return;
    const url = payload?.data?.url ?? config?.url;
    if (url) iframe.src = url;
    const sandbox = payload?.data?.sandbox ?? config?.sandbox;
    if (sandbox) iframe.sandbox = sandbox;
  }

  return {
    update(payload?: FramePayload) {
      apply(payload);
    },
    resize() {},
    destroy() {}
  };
}

export default createController;
