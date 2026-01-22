function buildSegments() {
  const ok = Math.round(50 + Math.random() * 40);
  const warn = Math.round(Math.random() * 25);
  const error = Math.round(Math.random() * 15);
  return [
    { label: 'OK', value: ok },
    { label: 'Warn', value: warn },
    { label: 'Error', value: error }
  ];
}

export default {
  interval: 7000,
  widgetId: 'donut',
  type: 'donut',
  run: emit => {
    emit({
      widgetId: 'donut',
      type: 'donut',
      data: {
        label: 'Checks',
        segments: buildSegments()
      },
      at: new Date().toISOString()
    });
  }
};
