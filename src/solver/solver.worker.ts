/// <reference lib="webworker" />
import { initSolver, solveFacelets } from './solveCore';

export type WorkerRequest = { id: number; type: 'init' } | { id: number; type: 'solve'; facelets: string };
export type WorkerResponse =
  | { id: number; type: 'ready'; ms: number }
  | { id: number; type: 'solution'; moves: string[]; verified: boolean; ms: number }
  | { id: number; type: 'error'; message: string };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    if (req.type === 'init') {
      const t0 = performance.now();
      initSolver();
      self.postMessage({ id: req.id, type: 'ready', ms: performance.now() - t0 } satisfies WorkerResponse);
    } else {
      const out = solveFacelets(req.facelets);
      self.postMessage({ id: req.id, type: 'solution', ...out } satisfies WorkerResponse);
    }
  } catch (err) {
    self.postMessage({ id: req.id, type: 'error', message: (err as Error).message } satisfies WorkerResponse);
  }
};
