export default {
  interval: 11000,
  widgetId: 'inspect',
  type: 'inspect',
  run: emit => {
    const now = new Date();
    emit({
      widgetId: 'inspect',
      type: 'inspect',
      data: {
        release: '2026.01.21',
        branch: 'dev',
        features: ['busy-demo', 'resize-hooks', 'feed'],
        nodes: [
          { name: 'api-1', load: Number((0.4 + Math.random() * 0.3).toFixed(2)) },
          { name: 'worker-2', load: Number((0.3 + Math.random() * 0.5).toFixed(2)) }
        ],
        refreshedAt: now.toISOString()
      },
      at: now.toISOString()
    });
  }
};
