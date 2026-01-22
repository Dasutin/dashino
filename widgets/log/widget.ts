import type { WidgetController } from "../../web/src/types";

type LogPayload = {
  at?: string;
  data?: {
    message?: string;
    level?: string;
    source?: string;
    at?: string;
  };
};

type LogEntry = {
  message: string;
  level: string;
  at: string;
};

const MAX_ENTRIES = 40;

function formatAt(at?: string) {
  if (!at) return "";
  const ms = Date.parse(at);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function extract(payload?: LogPayload): LogEntry | null {
  if (!payload) return null;
  const message = payload.data?.message ?? "";
  const level = (payload.data?.level ?? "info").toLowerCase();
  const at = formatAt(payload.data?.at ?? payload.at);
  if (!message) return null;
  return { message, level, at };
}

export function createController({ root }: { root: HTMLElement }): WidgetController {
  const metaEl = root.querySelector<HTMLElement>(".log-meta");
  const list = root.querySelector<HTMLElement>(".log-list");

  if (!list) return {};

  const entries: LogEntry[] = [];

  function render() {
    list.innerHTML = "";
    entries.slice(0, MAX_ENTRIES).forEach(entry => {
      const row = document.createElement("div");
      row.className = "log-entry";

      const lvl = document.createElement("div");
      lvl.className = `log-level ${entry.level}`;
      lvl.textContent = entry.level;

      const msg = document.createElement("div");
      msg.className = "log-message";
      msg.textContent = entry.message;

      const time = document.createElement("div");
      time.className = "log-time";
      time.textContent = entry.at;

      row.appendChild(lvl);
      row.appendChild(msg);
      row.appendChild(time);
      list.appendChild(row);
    });
  }

  return {
    update(payload?: LogPayload) {
      const entry = extract(payload);
      if (!entry) return;
      entries.unshift(entry);
      if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
      if (metaEl) metaEl.textContent = entry.at;
      render();
    },
    resize() {},
    destroy() {
      list.innerHTML = "";
    }
  };
}

export default createController;