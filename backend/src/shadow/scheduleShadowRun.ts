import path from 'path';
import { Worker } from 'worker_threads';
import { newShadowRunId, runShadowPipeline, type ShadowWorkerPayload } from './shadowPipeline';

/**
 * Runs the shadow security pipeline in a worker thread (non-blocking for the HTTP server).
 * Falls back to in-process execution if the worker fails to start (e.g. path resolution).
 */
export function scheduleShadowRun(payload: Omit<ShadowWorkerPayload, 'runId'> & { runId?: string }): void {
  const runId = payload.runId ?? newShadowRunId();
  const full: ShadowWorkerPayload = {
    ...payload,
    runId,
  };

  const isTs = __filename.endsWith('.ts');
  const workerFile = isTs ? 'shadowWorker.ts' : 'shadowWorker.js';
  const workerPath = path.join(__dirname, workerFile);

  try {
    const worker = new Worker(workerPath, {
      workerData: full,
      execArgv: isTs ? [...process.execArgv, '-r', 'ts-node/register'] : undefined,
    });
    worker.on('message', (msg: { ok?: boolean; error?: string }) => {
      if (msg?.ok === false && msg.error) {
        console.error('[Shadow] worker reported error:', msg.error);
      }
    });
    worker.on('error', (err) => {
      console.error('[Shadow] worker thread error:', err);
      void runShadowPipeline(full).catch((e) =>
        console.error('[Shadow] fallback pipeline failed:', e)
      );
    });
    worker.on('exit', (code) => {
      if (code !== 0) {
        console.warn(`[Shadow] worker exited with code ${code}`);
      }
    });
  } catch (e) {
    console.warn('[Shadow] could not spawn worker, running in-process:', e);
    void runShadowPipeline(full).catch((err) => console.error('[Shadow] pipeline failed:', err));
  }
}
