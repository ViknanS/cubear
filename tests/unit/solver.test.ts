import Cube from 'cubejs';
import { beforeAll, describe, expect, it } from 'vitest';
import { faceletsToStickers } from '../../src/cube/convert';
import { applyMovesToString, parseAlgorithm } from '../../src/cube/moves';
import { STANDARD_SCHEME, solvedFacelets } from '../../src/cube/types';
import { validateStickers } from '../../src/cube/validate';
import { initSolver, solveFacelets } from '../../src/solver/solveCore';
import { currentMove, isComplete, playbackReducer, progress } from '../../src/solver/playback';
import { DEMO_SCRAMBLE } from '../../src/state/demo';

beforeAll(() => initSolver());

describe('solver', () => {
  it('a solved cube returns zero moves', () => {
    expect(solveFacelets(solvedFacelets()).moves).toEqual([]);
  });

  it('solves the known demo scramble and the solution verifies', () => {
    const state = applyMovesToString(solvedFacelets(), parseAlgorithm(DEMO_SCRAMBLE));
    const { moves, verified } = solveFacelets(state);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.length).toBeLessThanOrEqual(22);
    expect(verified).toBe(true);
    expect(applyMovesToString(state, moves)).toBe(solvedFacelets());
  });

  it('solves 25 random physically valid states', () => {
    for (let i = 0; i < 25; i++) {
      const state = Cube.random().asString();
      expect(validateStickers(faceletsToStickers(state, STANDARD_SCHEME)).ok).toBe(true);
      const { moves } = solveFacelets(state);
      expect(applyMovesToString(state, moves)).toBe(solvedFacelets());
    }
  });

  it('works with any center color scheme (non-standard cube)', () => {
    const scheme = { U: 'blue', R: 'white', F: 'red', D: 'green', L: 'yellow', B: 'orange' } as const;
    const facelets = applyMovesToString(solvedFacelets(), parseAlgorithm("F R' U2 B L"));
    const v = validateStickers(faceletsToStickers(facelets, scheme));
    expect(v.ok).toBe(true);
    expect(applyMovesToString(facelets, solveFacelets(v.facelets!).moves)).toBe(solvedFacelets());
  });
});

describe('playback controls', () => {
  const moves = ['R', "U'", 'F2'];
  it('next / prev / restart / pause / resume update progress', () => {
    let s = playbackReducer({ moves: [], step: 0, paused: false }, { type: 'load', moves });
    expect(currentMove(s)).toBe('R');
    s = playbackReducer(s, { type: 'next' });
    s = playbackReducer(s, { type: 'next' });
    expect(s.step).toBe(2);
    expect(progress(s)).toBeCloseTo(2 / 3);
    s = playbackReducer(s, { type: 'prev' });
    expect(currentMove(s)).toBe("U'");
    s = playbackReducer(s, { type: 'pause' });
    expect(s.paused).toBe(true);
    s = playbackReducer(s, { type: 'resume' });
    expect(s.paused).toBe(false);
    s = playbackReducer(playbackReducer(playbackReducer(s, { type: 'next' }), { type: 'next' }), { type: 'next' });
    expect(isComplete(s)).toBe(true);
    expect(s.step).toBe(3); // clamped
    s = playbackReducer(s, { type: 'restart' });
    expect(s.step).toBe(0);
    s = playbackReducer(s, { type: 'prev' });
    expect(s.step).toBe(0); // clamped
  });
});
