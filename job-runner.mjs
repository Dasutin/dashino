import { pathToFileURL } from 'url';

const jobPath = process.argv[2];
if (!jobPath) {
  console.error('No job path provided');
  process.exit(1);
}

async function main() {
  try {
    const moduleUrl = pathToFileURL(jobPath).href;
    const mod = (await import(moduleUrl)).default;
    if (!mod || typeof mod.run !== 'function' || typeof mod.interval !== 'number') {
      console.error('Job missing interval/run', { jobPath });
      process.exit(1);
    }

    process.send?.({ type: 'meta', defaults: { widgetId: mod.widgetId, type: mod.type, interval: mod.interval } });

    const runOnce = async () => {
      try {
        await Promise.resolve(mod.run((message) => {
          process.send?.({ type: 'emit', payload: message });
        }));
      } catch (error) {
        process.send?.({ type: 'run-error', error: String(error) });
      }
    };

    await runOnce();
    const timer = setInterval(runOnce, mod.interval);

    process.on('disconnect', () => {
      clearInterval(timer);
      process.exit(0);
    });
  } catch (error) {
    console.error('Job runner failed', error);
    process.exit(1);
  }
}

main();
