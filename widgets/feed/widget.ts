import type { WidgetController } from "../../web/src/types";

type MessagePayload = {
	text?: string;
	source?: string;
	at?: string;
	data?: {
		text?: string;
		source?: string;
		at?: string;
	};
};

type FeedItem = {
	text: string;
	source: string;
	at: string;
};

const DEFAULT_SOURCE = "Feed";
const FALLBACK_CAPACITY = 4;
const MAX_HISTORY = 50;
const FALLBACK_ITEM_HEIGHT = 52;

function formatAt(at?: string) {
	if (!at) return "";
	const ms = Date.parse(at);
	if (!Number.isFinite(ms)) return "";
	return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function extractPayload(payload?: MessagePayload): FeedItem | null {
	if (!payload) return null;
	const src = (payload.data as any)?.source ?? payload.source ?? DEFAULT_SOURCE;
	const text = (payload.data as any)?.text ?? payload.text;
	const atRaw = (payload.data as any)?.at ?? payload.at;
	const at = formatAt(atRaw);
	if (!text) return null;
	return { text, source: src, at };
}

export function createController({ root }: { root: HTMLElement }): WidgetController {
	const feed = root.querySelector<HTMLElement>(".feed-list");
	const timestampEl = root.querySelector<HTMLElement>(".timestamp");
	const headerEl = root.querySelector<HTMLElement>(".header");

	if (!feed) return {};

	const items: FeedItem[] = [];
	let maxVisible = FALLBACK_CAPACITY;
	let itemHeight = FALLBACK_ITEM_HEIGHT;

	function applyCapacity(rect?: DOMRectReadOnly) {
		if (!rect) return;
		const headerHeight = headerEl?.offsetHeight ?? 0;
		const available = rect.height - headerHeight - 8; // account for gap
		if (available <= 0) return;
		if (itemHeight > 0) {
			const fit = Math.floor(available / itemHeight);
			if (fit >= 1) {
				maxVisible = Math.min(MAX_HISTORY, Math.max(1, fit));
			}
		}
	}

	function render() {
		const visible = items.slice(0, maxVisible);
		feed.innerHTML = "";
		visible.forEach(entry => {
			const container = document.createElement("div");
			container.className = "feed-item";

			const text = document.createElement("div");
			text.className = "text";
			text.textContent = entry.text;

			const meta = document.createElement("div");
			meta.className = "meta";
			meta.textContent = entry.at || "";

			container.appendChild(text);
			container.appendChild(meta);
			feed.appendChild(container);
		});

		const first = feed.firstElementChild as HTMLElement | null;
		if (first) {
			const rect = first.getBoundingClientRect();
			if (rect.height > 0) {
				itemHeight = rect.height;
			}
		}
	}

	return {
		update(payload?: MessagePayload) {
			const entry = extractPayload(payload);
			if (!entry) return;

			if (timestampEl) {
				timestampEl.textContent = entry.at;
			}

			items.unshift(entry);
			if (items.length > MAX_HISTORY) items.length = MAX_HISTORY;
			if (items.length > maxVisible) items.length = Math.min(items.length, maxVisible);

			render();
		},
		resize(rect: DOMRectReadOnly) {
			applyCapacity(rect);
			render();
		},
		destroy() {
			feed.innerHTML = "";
		}
	};
}

export default createController;
