const sampleMessages = [
  "Latency normal across regions",
  "Deploy queued for approval",
  "Background job backlog cleared",
  "Cache warm completed",
  "All systems operational",
  "New PRs ready for review",
  "Dashcam upload finished",
  "CI green on main",
  "Reboot scheduled tonight",
  "Backups verified",
  "Service map updated",
  "Firmware push staged"
];

export default {
  interval: 7000,
  widgetId: 'feed',
  type: 'feed',
  run: emit => {
    const pick = sampleMessages[Math.floor(Math.random() * sampleMessages.length)];
    emit({
      widgetId: 'feed',
      type: 'feed',
      data: {
        text: pick,
        source: 'Feed'
      },
      at: new Date().toISOString()
    });
  }
};
