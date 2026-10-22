import type { WorkerRequest, WorkerResponse } from './solver.worker';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.type === 'error') p.reject(new Error(e.data.message));
    else p.resolve(e.data);
  };
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || 'Solver worker crashed'));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
function call(req: DistributiveOmit<WorkerRequest, "id">): Promise<WorkerResponse> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ ...req, id } as WorkerRequest);
  });
}

let warm: Promise<WorkerResponse> | null = null;
/** Build the Kociemba pruning tables in the background (≈1–3 s on phones). */
export function warmUpSolver(): Promise<WorkerResponse> {
  if (typeof Worker === 'undefined') return Promise.reject(new Error('Web Workers are not supported'));
  warm ??= call({ type: 'init' });
  return warm;
}

export async function solveInWorker(facelets: string): Promise<{ moves: string[]; verified: boolean; ms: number }> {
  if (typeof Worker === 'undefined') {
    // Fallback for very old browsers: solve on the main thread.
    const { solveFacelets } = await import('./solveCore');
    return solveFacelets(facelets);
  }
  await warmUpSolver();
  const r = await call({ type: 'solve', facelets });
  if (r.type !== 'solution') throw new Error('Unexpected solver response');
  return { moves: r.moves, verified: r.verified, ms: r.ms };
}
