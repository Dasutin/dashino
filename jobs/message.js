const sampleMessages = [
  'Latency normal across regions',
  'Deploy queued for approval',
  'Background job backlog cleared',
  'Cache warm completed',
  'All systems operational'
];

export default {
  interval: 7000,
  widgetId: 'message',
  type: 'message',
  run: emit => {
    const pick = sampleMessages[Math.floor(Math.random() * sampleMessages.length)];
    emit({
      widgetId: 'message',
      type: 'message',
      data: {
        text: pick,
        source: 'Demo feed'
      },
      at: new Date().toISOString()
    });
  }
};
