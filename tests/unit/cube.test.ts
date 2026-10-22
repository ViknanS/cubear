import Cube from 'cubejs';
import { describe, expect, it } from 'vitest';
import { FACELETS, faceletAt } from '../../src/cube/geometry';
import { ALL_MOVES, applyMoves, applyMovesToString, describeMove, invertAlgorithm, invertMove, parseAlgorithm, parseMove } from '../../src/cube/moves';
import { faceletsToStickers, stickersToFacelets } from '../../src/cube/convert';
import { FACES, STANDARD_SCHEME, solvedFacelets } from '../../src/cube/types';

const SOLVED = solvedFacelets();

describe('facelet geometry / orientation mapping', () => {
  it('every facelet has a unique position+normal', () => {
    const keys = new Set(FACELETS.map((g) => g.pos.join() + '|' + g.normal.join()));
    expect(keys.size).toBe(54);
    FACELETS.forEach((g, i) => expect(faceletAt(g.pos, g.normal)).toBe(i));
  });

  it('matches the Kociemba net: U9/R1/F3 share the URF corner, D1/F7/L9 share DLF', () => {
    const p = (i: number) => FACELETS[i].pos.join();
    expect(p(8)).toBe(p(9));
    expect(p(9)).toBe(p(20));
    expect(p(27)).toBe(p(24));
    expect(p(24)).toBe(p(44));
    // B1 is top-left when viewing B from behind, i.e. on the +x (right) side of the cube
    expect(FACELETS[45].pos).toEqual([1, 1, -1]);
  });

  it('faces are ordered URFDLB and centers sit on axes', () => {
    FACES.forEach((_, f) => expect(FACELETS[9 * f + 4].pos.filter((v) => v !== 0)).toHaveLength(1));
  });
});

describe('moves', () => {
  it('every basic move agrees with the cubejs reference implementation', () => {
    for (const m of ALL_MOVES) {
      const ref = new Cube().move(m).asString();
      expect(applyMovesToString(SOLVED, [m]), m).toBe(ref);
    }
  });

  it('agrees with cubejs on a long random sequence', () => {
    const seq = Array.from({ length: 60 }, (_, i) => ALL_MOVES[(i * 7 + 3) % 18]);
    expect(applyMovesToString(SOLVED, seq)).toBe(new Cube().move(seq.join(' ')).asString());
  });

  it('each move followed by its inverse is identity; X4 is identity', () => {
    for (const m of ALL_MOVES) {
      expect(applyMovesToString(SOLVED, [m, invertMove(m)])).toBe(SOLVED);
      const q = parseMove(m).face;
      expect(applyMovesToString(SOLVED, [q, q, q, q])).toBe(SOLVED);
      expect(applyMovesToString(SOLVED, [q, q])).toBe(applyMovesToString(SOLVED, [`${q}2`]));
      expect(applyMovesToString(SOLVED, [q, q, q])).toBe(applyMovesToString(SOLVED, [`${q}'`]));
    }
  });

  it('inverting an algorithm undoes it; sexy move has order 6', () => {
    const alg = parseAlgorithm("R U R' U' F2 D L' B2");
    expect(applyMovesToString(applyMovesToString(SOLVED, alg), invertAlgorithm(alg))).toBe(SOLVED);
    const sexy = parseAlgorithm("R U R' U'");
    let s = SOLVED;
    for (let i = 0; i < 6; i++) s = applyMovesToString(s, sexy);
    expect(s).toBe(SOLVED);
  });

  it('a move only changes the 21 stickers in its layer', () => {
    const s = applyMovesToString(SOLVED, ['R']);
    const changed = [...s].filter((c, i) => c !== SOLVED[i]).length;
    expect(changed).toBe(12); // R face stickers keep their color; 12 side stickers move.
  });

  it('rejects invalid notation and describes moves in plain English', () => {
    expect(() => parseMove('X')).toThrow();
    expect(describeMove("R'")).toContain('counterclockwise');
    expect(describeMove('U2')).toContain('180');
  });

  it('applies to arbitrary arrays (colors)', () => {
    const colors = faceletsToStickers(SOLVED, STANDARD_SCHEME);
    const moved = applyMoves(colors, ['F']);
    expect(stickersToFacelets(moved)).toBe(applyMovesToString(SOLVED, ['F']));
  });
});
