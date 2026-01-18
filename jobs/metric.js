export default {
  interval: 5000,
  widgetId: 'metric-1',
  type: 'metric',
  run: emit => {
    const value = Math.random() * 1000;
    const delta = (Math.random() * 10 - 5).toFixed(2);
    emit({
      widgetId: 'metric-1',
      type: 'metric',
      data: {
        label: 'Random throughput',
        value: value.toFixed(2),
        delta: `${delta}%`
      },
      at: new Date().toISOString()
    });
  }
};
