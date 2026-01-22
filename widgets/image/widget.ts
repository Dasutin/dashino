import type { WidgetController } from "../../web/src/types";

type ImagePayload = {
  data?: {
    url?: string;
    caption?: string;
    fit?: "cover" | "contain";
  };
};

export function createController({ root }: { root: HTMLElement }): WidgetController {
  const img = root.querySelector<HTMLImageElement>(".image-tag");
  const fallback = root.querySelector<HTMLElement>(".image-fallback");
  const frame = root.querySelector<HTMLElement>(".image-frame");
  const caption = root.querySelector<HTMLElement>(".image-caption");

  function applyFit(fit?: string) {
    if (!frame) return;
    frame.classList.remove("cover", "contain");
    if (fit === "contain") frame.classList.add("contain");
    else frame.classList.add("cover");
  }

  function setImage(url?: string) {
    if (!img || !fallback) return;
    if (!url) {
      img.style.display = "none";
      fallback.style.display = "flex";
      return;
    }
    img.onload = () => {
      if (img) img.style.display = "block";
      if (fallback) fallback.style.display = "none";
    };
    img.onerror = () => {
      if (img) img.style.display = "none";
      if (fallback) fallback.style.display = "flex";
    };
    img.src = url;
  }

  return {
    update(payload?: ImagePayload) {
      applyFit(payload?.data?.fit);
      setImage(payload?.data?.url);
      if (caption) caption.textContent = payload?.data?.caption ?? "";
    },
    resize() {},
    destroy() {
      if (img) {
        img.onload = null;
        img.onerror = null;
      }
    }
  };
}

export default createController;
