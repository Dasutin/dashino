import type { WidgetController, WidgetFactory } from '../../web/src/types';

type ClockPayload = {
	time?: string;
	date?: string;
};

export const createClockController: WidgetFactory = ({ root }) => new ClockController(root);
export default createClockController;

class ClockController implements WidgetController {
	private root: HTMLElement;
	private timer: number | null = null;

	constructor(root: HTMLElement) {
		this.root = root;
		this.render();
		this.timer = window.setInterval(() => this.render(), 1000);
	}

	update(payload?: ClockPayload) {
		// With no SSE-driven clock, we ignore payload and rely on client render
	}

	destroy() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	private render() {
		const now = new Date();
		const timeEl = this.root.querySelector('.time');
		const dateEl = this.root.querySelector('.date');

		const date = now
			.toLocaleDateString('en-US', {
				weekday: 'short',
				month: 'short',
				day: '2-digit',
				year: 'numeric'
			})
			.replace(/,/g, '');

		const time = now
			.toLocaleTimeString('en-US', {
				hour12: true,
				hour: 'numeric',
				minute: '2-digit',
				second: '2-digit'
			})
			.replace(/\s?[AP]M$/i, '');

		if (timeEl) timeEl.textContent = time;
		if (dateEl) dateEl.textContent = date;
	}
}
