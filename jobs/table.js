const services = ['api', 'worker', 'db', 'cache', 'auth', 'billing'];
const states = ['healthy', 'warning', 'degraded'];

function sample(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function makeRow(service) {
  return {
    Service: service,
    Status: sample(states),
    Latency: `${Math.round(30 + Math.random() * 120)}ms`,
    Errors: `${(Math.random() * 2).toFixed(2)}%`
  };
}

export default {
  interval: 8000,
  widgetId: 'table',
  type: 'table',
  run: emit => {
    const rows = services.map(makeRow);
    emit({
      widgetId: 'table',
      type: 'table',
      data: {
        columns: ['Service', 'Status', 'Latency', 'Errors'],
        rows
      }
    });
  }
};
