export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startStatusSyncWorker } = await import('./lib/status-sync');
    startStatusSyncWorker();
  }
}
