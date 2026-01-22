import type { WidgetController } from "../../web/src/types";

type ActionItem = {
  label: string;
  state?: "idle" | "running" | "done" | "error" | string;
  detail?: string;
};

type ActionsPayload = {
  data?: {
    items?: ActionItem[];
  };
};

export function createController({ root }: { root: HTMLElement }): WidgetController {
  const list = root.querySelector<HTMLElement>(".actions-list");
  if (!list) return {};

  function render(items: ActionItem[]) {
    list.innerHTML = "";
    items.forEach(item => {
      const row = document.createElement("div");
      row.className = "action-row";

      const label = document.createElement("div");
      label.className = "action-label";
      label.textContent = item.label;

      const detail = document.createElement("div");
      detail.className = "action-detail";
      detail.textContent = item.detail ?? "";

      const state = document.createElement("div");
      const stateName = (item.state ?? "idle").toLowerCase();
      state.className = `action-state ${stateName}`;
      state.textContent = stateName;

      const textCol = document.createElement("div");
      textCol.style.display = "flex";
      textCol.style.flexDirection = "column";
      textCol.style.gap = "2px";
      textCol.appendChild(label);
      if (item.detail) textCol.appendChild(detail);

      row.appendChild(textCol);
      row.appendChild(state);
      list.appendChild(row);
    });
  }

  return {
    update(payload?: ActionsPayload) {
      render(payload?.data?.items ?? []);
    },
    resize() {},
    destroy() {
      list.innerHTML = "";
    }
  };
}

export default createController;