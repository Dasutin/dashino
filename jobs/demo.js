export default {
  interval: 60000,
  widgetId: 'demo-job',
  type: 'message',
  async run(emit) {
    emit({
      widgetId: 'demo-job',
      type: 'message',
      data: { text: 'Demo job heartbeat' },
      at: new Date().toISOString()
    });
  }
};
