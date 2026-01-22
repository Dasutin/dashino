const states = [
  { state: 'ok', message: 'All systems nominal', detail: 'No incidents' },
  { state: 'warn', message: 'Latency elevated', detail: 'us-east under load' },
  { state: 'error', message: 'Deploy halted', detail: 'Rollback queued' }
];

export default {
  interval: 6000,
  widgetId: 'status',
  type: 'status',
  run: emit => {
    const pick = states[Math.floor(Math.random() * states.length)];
    emit({
      widgetId: 'status',
      type: 'status',
      data: { ...pick },
      at: new Date().toISOString()
    });
  }
};
