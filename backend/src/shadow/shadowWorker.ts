import { parentPort, workerData } from 'worker_threads';
import { runShadowPipeline, type ShadowWorkerPayload } from './shadowPipeline';

const payload = workerData as ShadowWorkerPayload;

runShadowPipeline(payload)
  .then(() => {
    parentPort?.postMessage({ ok: true });
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    parentPort?.postMessage({ ok: false, error: message });
  });
