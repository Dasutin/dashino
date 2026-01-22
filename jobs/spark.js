let current = 50;

export default {
  interval: 3000,
  widgetId: 'spark',
  type: 'spark',
  run: emit => {
    current += Math.random() * 10 - 5;
    current = Math.max(10, Math.min(95, current));
    emit({
      widgetId: 'spark',
      type: 'spark',
      data: { value: Number(current.toFixed(1)) },
      at: new Date().toISOString()
    });
  }
};
