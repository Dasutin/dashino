const phases = ['init', 'baking', 'verifying', 'shipping'];

function sample(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export default {
  interval: 4500,
  widgetId: 'progress',
  type: 'progress',
  run: emit => {
    const value = Math.random() * 100;
    const phase = sample(phases);
    emit({
      widgetId: 'progress',
      type: 'progress',
      data: {
        value,
        max: 100,
        label: 'Deploy',
        state: phase
      },
      at: new Date().toISOString()
    });
  }
};
