export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.CAUSE_MATERIAL_JOBS_ENABLED === '1') {
    const { startMaterialWorker } = await import('./lib/server/material-job-runner')
    startMaterialWorker()
  }
}
