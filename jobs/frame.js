const frames = [
  {
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    sandbox: 'allow-scripts allow-same-origin allow-presentation'
  },
  {
    url: 'https://www.openstreetmap.org/export/embed.html?bbox=-80.2%2C40.3%2C-71.7%2C45.1&layer=mapnik',
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
