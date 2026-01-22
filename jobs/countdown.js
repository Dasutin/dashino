export default {
  interval: 10000,
  widgetId: 'countdown',
  type: 'countdown',
  run: emit => {
    const target = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    emit({
      widgetId: 'countdown',
      type: 'countdown',
      data: {
        target,
        label: 'Next release window',
        mode: 'until'
      }
    });
  }
};
