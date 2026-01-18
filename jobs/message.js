const sampleMessages = [
  'Latency normal across regions',
  'Deploy queued for approval',
  'Background job backlog cleared',
  'Cache warm completed',
  'All systems operational'
];

export default {
  interval: 7000,
  widgetId: 'message-1',
  type: 'message',
  run: emit => {
    const pick = sampleMessages[Math.floor(Math.random() * sampleMessages.length)];
    emit({
      widgetId: 'message-1',
      type: 'message',
      data: {
        text: pick,
        source: 'jobs/message'
      },
      at: new Date().toISOString()
    });
  }
};
