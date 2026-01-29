import fs from 'fs/promises';
import path from 'path';

const INSTANCES_DIR = path.resolve(process.cwd(), 'widget-instances');

const fallbackInstance = {
  id: 'image',
  name: 'Demo Images',
  images: [
    {
      url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1400&q=80',
      caption: 'City at dusk',
      fit: 'cover'
    },
    {
      url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1400&q=80',
      caption: 'Hiking trip',
      fit: 'cover'
    },
    {
      url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1400&q=80',
      caption: 'Upstate forest',
      fit: 'cover'
    },
    {
      url: 'https://images.unsplash.com/photo-1458668383970-8ddd3927deed?auto=format&fit=crop&w=1400&q=80',
      caption: 'Mountains',
      fit: 'cover'
    },
    {
      url: 'https://images.unsplash.com/photo-1482192505345-5655af888cc4?auto=format&fit=crop&w=1400&q=80',
      caption: 'Cabin on the lake',
      fit: 'cover'
    },
    {
      url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1400&q=80',
      caption: 'Earth from space at night',
      fit: 'cover'
    },
    {
      url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1400&q=80',
      caption: 'Winter sky',
      fit: 'cover'
    },
    {
      url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1400&q=80',
      caption: 'Boating on the lake',
      fit: 'cover'
    }
  ]
};

const normalizeUrl = value => {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value.trim());
    return url.toString();
  } catch {
    return '';
  }
};

const safeParseJson = async filePath => {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const validateImageInstance = input => {
  if (!input || typeof input !== 'object') return null;
  const type = typeof input.type === 'string' ? input.type.trim() : '';
  if (type !== 'image') return null;
  const id = typeof input.id === 'string' ? input.id.trim() : '';
  if (!id) return null;
  const name = typeof input.name === 'string' ? input.name.trim() : id;
  const cfg = input.config || {};
  const imagesRaw = Array.isArray(cfg.images) ? cfg.images : [];
  const images = imagesRaw
    .map(img => {
      if (!img || typeof img !== 'object') return null;
      const url = normalizeUrl(img.url || '');
      if (!url) return null;
      const caption = typeof img.caption === 'string' ? img.caption.trim() : undefined;
      const fitRaw = typeof img.fit === 'string' ? img.fit.trim().toLowerCase() : undefined;
      const fit = fitRaw === 'contain' ? 'contain' : 'cover';
      return { url, caption, fit };
    })
    .filter(Boolean);

  if (!images.length) return null;
  return { id, name, images };
};

const loadImageInstances = async () => {
  try {
    const files = await fs.readdir(INSTANCES_DIR);
    const instances = await Promise.all(
      files
        .filter(f => f.endsWith('.json'))
        .map(async f => {
          const json = await safeParseJson(path.join(INSTANCES_DIR, f));
          return validateImageInstance(json);
        })
    );
    return instances.filter(Boolean);
  } catch {
    return [];
  }
};

const sample = array => array[Math.floor(Math.random() * array.length)];

export default {
  interval: 15000,
  widgetId: fallbackInstance.id,
  type: 'image',
  run: async emit => {
    const instances = await loadImageInstances();
    const targets = instances.length ? instances : [fallbackInstance];

    for (const inst of targets) {
      const pick = sample(inst.images || []);
      if (!pick) continue;
      emit({
        widgetId: inst.id,
        type: 'image',
        data: {
          url: pick.url,
          caption: pick.caption,
          fit: pick.fit || 'cover',
          title: inst.name
        }
      });
    }
  }
};