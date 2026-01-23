import type { StreamPayload, WidgetFactory } from '../../web/src/types';

type RssItem = {
  id: string;
  source: string;
  title: string;
  link: string | null;
  publishedAt: string | null;
};

type RssData = {
  title?: string;
  updatedAt?: string;
  error?: string;
  items?: RssItem[];
};

const MAX_ITEMS = 12;

const formatTime = (iso?: string) => {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

const formatMetaDate = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

const rssFactory: WidgetFactory = ({ root }) => {
  const titleEl = root.querySelector('.rss-title') as HTMLElement | null;
  const updatedEl = root.querySelector('.rss-updated') as HTMLElement | null;
  const errorEl = root.querySelector('.rss-error') as HTMLElement | null;
  const listEl = root.querySelector('.rss-list') as HTMLElement | null;

  const render = (data?: RssData) => {
    const title = data?.title || 'Headlines';
    if (titleEl) titleEl.textContent = title;

    if (updatedEl) updatedEl.textContent = `Updated ${formatTime(data?.updatedAt)}`;

    if (errorEl) {
      if (data?.error) {
        errorEl.textContent = data.error;
        errorEl.classList.add('visible');
      } else {
        errorEl.textContent = '';
        errorEl.classList.remove('visible');
      }
    }

    if (!listEl) return;
    listEl.replaceChildren();

    const items = (data?.items || []).slice(0, MAX_ITEMS);
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'rss-item';

      const headline = document.createElement('div');
      headline.className = 'rss-headline';
      headline.textContent = item.title;
      row.appendChild(headline);

      const meta = document.createElement('div');
      meta.className = 'rss-meta';
      const dateText = formatMetaDate(item.publishedAt);
      meta.textContent = `${item.source}${dateText ? ` • ${dateText}` : ''}`;
      row.appendChild(meta);

      if (item.link) {
        const link = document.createElement('a');
        link.className = 'rss-open';
        link.href = item.link;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.textContent = 'Open';
        row.appendChild(link);
      } else {
        const spacer = document.createElement('div');
        spacer.style.gridColumn = '2 / 3';
        row.appendChild(spacer);
      }

      listEl.appendChild(row);
    });
  };

  return {
    update: (payload?: StreamPayload) => {
      if (!payload || payload.type !== 'rss') return;
      render(payload.data as RssData);
    }
  };
};

export default rssFactory;
