const messages = [
  { level: 'info', message: 'Health check passed' },
  { level: 'warn', message: 'Retrying failed request' },
  { level: 'error', message: 'Job runner stalled' },
  { level: 'info', message: 'Cache warmed' },
  { level: 'warn', message: 'High memory on worker-2' }
];

function sample(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export default {
  interval: 5500,
  widgetId: 'log',
  type: 'log',
  run: emit => {
    const pick = sample(messages);
    emit({
      widgetId: 'log',
      type: 'log',
      data: pick,
      at: new Date().toISOString()
    });
  }
};
