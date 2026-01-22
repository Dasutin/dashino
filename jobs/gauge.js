export default {
  interval: 5000,
  widgetId: 'gauge',
  type: 'gauge',
  run: emit => {
    const value = 40 + Math.random() * 60;
    emit({
      widgetId: 'gauge',
      type: 'gauge',
      data: {
        value: Math.round(value),
        min: 0,
        max: 100,
        label: 'CPU Util',
        unit: '%'
      },
      at: new Date().toISOString()
    });
  }
};
