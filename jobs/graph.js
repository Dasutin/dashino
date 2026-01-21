export default {
  interval: 5000,
  widgetId: 'graph',
  type: 'graph',
  run: emit => {
    const now = new Date();
    const value = Math.random() * 100;
    emit({
      widgetId: 'graph',
      type: 'graph',
      at: now.toISOString(),
      data: {
        value: Number(value.toFixed(2)),
        label: now.toLocaleTimeString()
      }
    });
  }
};
