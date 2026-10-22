// Kociemba two-phase solver from the `cubejs` package (CommonJS). Shared by the Web Worker and tests.
import Cube from 'cubejs';
import { applyMovesToString, parseAlgorithm } from '../cube/moves';
import { solvedFacelets } from '../cube/types';

let initialized = false;

export function initSolver(): void {
  if (initialized) return;
  Cube.initSolver();
  initialized = true;
}

export interface SolveOutput {
  moves: string[];
  /** True when our independent move engine confirmed the moves solve the input. */
  verified: boolean;
  ms: number;
}

/** Solve a validated URFDLB facelet string. Throws if the result does not verify. */
export function solveFacelets(facelets: string, maxDepth = 22): SolveOutput {
  const t0 = performance.now();
  const solved = solvedFacelets();
  if (facelets === solved) return { moves: [], verified: true, ms: 0 };
  initSolver();
  const cube = Cube.fromString(facelets);
  if (cube.asString() !== facelets) throw new Error('Solver could not represent this cube state.');
  const raw: string = cube.solve(maxDepth);
  const moves = parseAlgorithm(raw);
  const verified = applyMovesToString(facelets, moves) === solved;
  if (!verified) throw new Error('Solution failed internal verification.');
  return { moves, verified, ms: performance.now() - t0 };
}
