const images = [
  {
    url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
    caption: 'City lights',
    fit: 'cover'
  },
  {
    url: 'https://images.unsplash.com/photo-1526402462921-3611a9990b09?auto=format&fit=crop&w=900&q=80',
    caption: 'Mountains',
    fit: 'cover'
  },
  {
    url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=900&q=80',
    caption: 'Data center',
    fit: 'cover'
  }
];

function sample(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export default {
  interval: 15000,
  widgetId: 'image',
  type: 'image',
  run: emit => {
    const pick = sample(images);
    emit({ widgetId: 'image', type: 'image', data: pick });
  }
};
