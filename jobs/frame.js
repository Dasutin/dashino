const frames = [
  {
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    sandbox: 'allow-scripts allow-same-origin allow-presentation'
  },
  {
    url: 'https://www.openstreetmap.org/export/embed.html?bbox=13.37%2C52.50%2C13.45%2C52.52&layer=mapnik',
    sandbox: 'allow-scripts allow-same-origin allow-forms'
  }
];

function sample(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export default {
  interval: 20000,
  widgetId: 'frame',
  type: 'frame',
  run: emit => {
    const pick = sample(frames);
    emit({
      widgetId: 'frame',
      type: 'frame',
      data: pick
    });
  }
};
