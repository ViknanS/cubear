import { describe, expect, it } from 'vitest';
import { faceletsToStickers } from '../../src/cube/convert';
import { ALL_MOVES, applyMoveArray, applyMovesToString, parseAlgorithm } from '../../src/cube/moves';
import { STANDARD_SCHEME, solvedFacelets } from '../../src/cube/types';
import { CubeModel } from '../../src/three/CubeModel';

const scrambled = faceletsToStickers(applyMovesToString(solvedFacelets(), parseAlgorithm("R U F' L2 D B'")), STANDARD_SCHEME);

describe('3D cube model stays in sync with the move engine', () => {
  it('each of the 18 moves: geometry after the animation equals the engine state', async () => {
    for (const m of ALL_MOVES) {
      const model = new CubeModel(scrambled);
      const done = model.animateMove(m, 300);
      await Promise.resolve();
      // drive the animation in small frames like a 60 fps loop
      for (let i = 0; i < 40 && model.animating; i++) model.tick(1 / 60);
      await done;
      const expected = applyMoveArray(scrambled, m);
      expect(model.lastGeometryState, m).toEqual(expected);
      expect(model.state, m).toEqual(expected);
      model.dispose();
    }
  });

  it('a queued sequence ends in the same state as the engine', async () => {
    const model = new CubeModel(scrambled);
    const seq = parseAlgorithm("R2 U' F D2 L' B U2");
    const all = Promise.all(seq.map((m) => model.animateMove(m, 0)));
    for (let i = 0; i < 20; i++) { await Promise.resolve(); model.tick(1); }
    await all;
    expect(model.state).toEqual(seq.reduce((s, m) => applyMoveArray(s, m), scrambled));
  });

  it('highlights exactly the 21 stickers of the turning layer', () => {
    const model = new CubeModel(scrambled);
    model.highlightMove('R');
    expect((model as unknown as { highlighted: Set<number> }).highlighted.size).toBe(21);
    model.highlightMove(null);
    expect((model as unknown as { highlighted: Set<number> }).highlighted.size).toBe(0);
  });
});
