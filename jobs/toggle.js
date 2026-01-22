let on = false;

export default {
  interval: 6000,
  widgetId: 'toggle',
  type: 'toggle',
  run: emit => {
    on = !on;
    emit({
      widgetId: 'toggle',
      type: 'toggle',
      data: {
        state: on,
        detail: on ? 'Feature flags enabled' : 'Feature flags paused'
      }
    });
  }
};
