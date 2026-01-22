const notes = [
  'Keep dashboards open during deploy.',
  'Prod error budget reset tonight.',
  'Demo TV rotates every 30s.',
  'Remember to hydrate. ☕'
];

function sample(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export default {
  interval: 9000,
  widgetId: 'text',
  type: 'text',
  run: emit => {
    emit({
      widgetId: 'text',
      type: 'text',
      data: {
        title: 'Note',
        text: sample(notes)
      }
    });
  }
};
