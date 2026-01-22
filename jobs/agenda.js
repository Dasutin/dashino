function minutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

export default {
  interval: 12000,
  widgetId: 'agenda',
  type: 'agenda',
  run: emit => {
    const items = [
      { title: 'Standup', start: minutesFromNow(10), location: 'Zoom' },
      { title: 'Deploy review', start: minutesFromNow(40), location: 'War room' },
      { title: 'Lunch', start: minutesFromNow(120), location: 'Cafe' },
      { title: '1:1', start: minutesFromNow(210), location: 'Breakout A' }
    ];

    emit({
      widgetId: 'agenda',
      type: 'agenda',
      data: {
        title: 'Today',
        items
      }
    });
  }
};
