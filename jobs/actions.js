const states = ['idle', 'running', 'done', 'error'];

function sample(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export default {
  interval: 8000,
  widgetId: 'actions',
  type: 'actions',
  run: emit => {
    const items = [
      { label: 'Deploy', state: sample(states), detail: 'main → prod' },
      { label: 'Index', state: sample(states), detail: 'search:products' },
      { label: 'Backup', state: sample(states), detail: 's3 nightly' }
    ];

    emit({ widgetId: 'actions', type: 'actions', data: { items } });
  }
};
