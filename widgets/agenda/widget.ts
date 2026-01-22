import type { WidgetController } from "../../web/src/types";

type AgendaItem = { title: string; start: string; location?: string };

type AgendaPayload = {
  data?: {
    title?: string;
    start?: string;
    location?: string;
    items?: AgendaItem[];
  };
};

function formatTime(start?: string) {
  if (!start) return "";
  const ms = Date.parse(start);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function createController({ root }: { root: HTMLElement }): WidgetController {
  const mainTitle = root.querySelector<HTMLElement>(".agenda-item-title");
  const mainTime = root.querySelector<HTMLElement>(".agenda-item-time");
  const mainLoc = root.querySelector<HTMLElement>(".agenda-item-location");
  const list = root.querySelector<HTMLElement>(".agenda-list");
  const titleEl = root.querySelector<HTMLElement>(".agenda-title");

  function renderItems(items: AgendaItem[]) {
    if (!list) return;
    list.innerHTML = "";
    items.slice(0, 3).forEach(item => {
      const div = document.createElement("div");
      div.className = "agenda-item";
      const t = document.createElement("div");
      t.className = "agenda-item-title";
      t.textContent = item.title;
      const tm = document.createElement("div");
      tm.className = "agenda-item-time";
      tm.textContent = formatTime(item.start);
      const loc = document.createElement("div");
      loc.className = "agenda-item-location";
      loc.textContent = item.location ?? "";
      div.appendChild(t);
      div.appendChild(tm);
      div.appendChild(loc);
      list.appendChild(div);
    });
  }

  return {
    update(payload?: AgendaPayload) {
      const items = payload?.data?.items ?? [];
      const first = items[0] ?? {
        title: payload?.data?.title ?? "",
        start: payload?.data?.start ?? "",
        location: payload?.data?.location ?? ""
      };

      if (titleEl && payload?.data?.title) titleEl.textContent = payload.data.title;
      if (mainTitle) mainTitle.textContent = first.title ?? "";
      if (mainTime) mainTime.textContent = formatTime(first.start);
      if (mainLoc) mainLoc.textContent = first.location ?? "";
      renderItems(items.length ? items.slice(1) : []);
    },
    resize() {},
    destroy() {}
  };
}

export default createController;
