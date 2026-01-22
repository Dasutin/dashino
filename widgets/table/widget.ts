import type { WidgetController } from "../../web/src/types";

type TablePayload = {
  data?: {
    columns?: string[];
    rows?: Array<Record<string, string | number>>;
  };
};

const MAX_ROWS = 8;

export function createController({ root }: { root: HTMLElement }): WidgetController {
  const headRow = root.querySelector<HTMLElement>(".table-head-row");
  const body = root.querySelector<HTMLElement>(".rows");

  function render(payload?: TablePayload) {
    if (!headRow || !body) return;
    const columns = payload?.data?.columns;
    const rows = payload?.data?.rows ?? [];

    headRow.innerHTML = "";
    body.innerHTML = "";

    const headers = columns ?? (rows[0] ? Object.keys(rows[0]) : []);

    headers.forEach(col => {
      const th = document.createElement("th");
      th.textContent = col;
      headRow.appendChild(th);
    });

    rows.slice(0, MAX_ROWS).forEach(row => {
      const tr = document.createElement("tr");
      headers.forEach(col => {
        const td = document.createElement("td");
        const val = row[col];
        td.textContent = val === undefined ? "" : String(val);
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  }

  return {
    update(payload?: TablePayload) {
      render(payload);
    },
    resize() {},
    destroy() {}
  };
}

export default createController;
