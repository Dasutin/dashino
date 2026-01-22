const services = ['API', 'Worker', 'DB', 'Cache', 'Search'];

function sampleValues() {
  return services.map(() => Math.round(40 + Math.random() * 60));
}

export default {
  interval: 6500,
  widgetId: 'bar',
  type: 'bar',
  run: emit => {
    emit({
      widgetId: 'bar',
      type: 'bar',
      data: {
        labels: services,
        values: sampleValues(),
        label: 'Requests per min'
      },
      at: new Date().toISOString()
    });
  }
};
