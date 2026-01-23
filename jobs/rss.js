const USER_AGENT = 'dashino-rss/1.0';
const TIMEOUT_MS = 12_000;
const MAX_ITEMS = 12;

const feeds = [
  { name: 'Hacker News', url: 'https://hnrss.org/frontpage' },
  { name: 'BBC World', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' }
];

const decodeEntities = input => {
  const withoutCdata = input.replace(/<!\[CDATA\[(.*?)\]\]>/gis, '$1');
  return withoutCdata
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'");
};

const pickTag = (block, tags) => {
  for (const tag of tags) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = block.match(re);
    if (match?.[1]) return decodeEntities(match[1].trim());
  }
  return null;
};

const pickAtomLink = block => {
  const re = /<link[^>]*href=["']([^"']+)["'][^>]*>/i;
  const match = block.match(re);
  return match?.[1] ? decodeEntities(match[1].trim()) : null;
};

const toIso = value => {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? new Date(ts).toISOString() : null;
};

const makeId = (source, title, link) => [source || '', title || '', link || ''].join('|').toLowerCase();

const parseRss = (xml, source) => {
  const blocks = xml.match(new RegExp('<item[\\s\\S]*?<\\/item>', 'gi')) || [];
  return blocks
    .map(block => {
      const title = pickTag(block, ['title']);
      if (!title) return null;
      const link = pickTag(block, ['link']);
      const publishedAt = toIso(pickTag(block, ['pubDate', 'published', 'updated']));
      return {
        id: makeId(source, title, link),
        source,
        title,
        link: link || null,
        publishedAt
      };
    })
    .filter(Boolean);
};

const parseAtom = (xml, source) => {
  const blocks = xml.match(new RegExp('<entry[\\s\\S]*?<\\/entry>', 'gi')) || [];
  return blocks
    .map(block => {
      const title = pickTag(block, ['title']);
      if (!title) return null;
      const link = pickAtomLink(block);
      const publishedAt = toIso(pickTag(block, ['updated', 'published']));
      return {
        id: makeId(source, title, link),
        source,
        title,
        link: link || null,
        publishedAt
      };
    })
    .filter(Boolean);
};

const parseFeed = (xml, source) => {
  if (/<rss[^>]*>/i.test(xml) || /<channel[^>]*>/i.test(xml)) {
    return parseRss(xml, source);
  }
  if (/<feed[^>]*>/i.test(xml)) {
    return parseAtom(xml, source);
  }
  return [];
};

const fetchWithTimeout = async url => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'application/rss+xml, application/atom+xml, text/xml, */*;q=0.1'
      },
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
};

export default {
  interval: 60_000,
  widgetId: 'rss',
  type: 'rss',
  run: async emit => {
    try {
      const results = [];
      for (const feed of feeds) {
        try {
          const xml = await fetchWithTimeout(feed.url);
          const items = parseFeed(xml, feed.name);
          results.push(...items);
        } catch (err) {
          // skip this feed on error
        }
      }

      const byId = new Map();
      results.forEach(item => {
        if (!byId.has(item.id)) {
          byId.set(item.id, item);
        }
      });

      const merged = Array.from(byId.values())
        .sort((a, b) => {
          const da = a.publishedAt ? Date.parse(a.publishedAt) : -Infinity;
          const db = b.publishedAt ? Date.parse(b.publishedAt) : -Infinity;
          if (da === db) return 0;
          return db - da;
        })
        .slice(0, MAX_ITEMS);

      emit({
        widgetId: 'rss',
        type: 'rss',
        data: {
          title: 'Headlines',
          updatedAt: new Date().toISOString(),
          items: merged
        }
      });
    } catch (err) {
      emit({
        widgetId: 'rss',
        type: 'rss',
        data: {
          title: 'Headlines',
          updatedAt: new Date().toISOString(),
          error: `${err}`,
          items: []
        }
      });
    }
  }
};
