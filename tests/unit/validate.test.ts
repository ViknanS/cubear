import { describe, expect, it } from 'vitest';
import { faceletsToStickers } from '../../src/cube/convert';
import { applyMovesToString, parseAlgorithm } from '../../src/cube/moves';
import { STANDARD_SCHEME, solvedFacelets, type StickerArray } from '../../src/cube/types';
import { CORNER_FACELETS, EDGE_FACELETS, rotateFaceStickers, suggestFaceRotations, validateStickers } from '../../src/cube/validate';

const scrambled = () => faceletsToStickers(applyMovesToString(solvedFacelets(), parseAlgorithm("R U2 F' L D B2 R' U F2 D'")), STANDARD_SCHEME);

describe('validation', () => {
  it('accepts solved and scrambled cubes', () => {
    expect(validateStickers(faceletsToStickers(solvedFacelets(), STANDARD_SCHEME)).ok).toBe(true);
    const r = validateStickers(scrambled());
    expect(r.ok).toBe(true);
    expect(r.facelets).toHaveLength(54);
  });

  it('rejects unassigned stickers and wrong lengths', () => {
    const s = scrambled();
    s[10] = null;
    expect(validateStickers(s).issues[0].code).toBe('incomplete');
    expect(validateStickers(s.slice(0, 50)).ok).toBe(false);
  });

  it('rejects invalid color counts', () => {
    const s = scrambled();
    s[0] = s[0] === 'red' ? 'blue' : 'red';
    const r = validateStickers(s);
    expect(r.ok).toBe(false);
    expect(r.issues[0].code).toBe('color-count');
    expect(r.issues[0].message).toMatch(/exactly 9/);
  });

  it('rejects duplicate center colors', () => {
    const s = faceletsToStickers(solvedFacelets(), STANDARD_SCHEME);
    // swap a center with a non-center so counts stay 9 but two centers match
    const tmp = s[4];
    s[4] = s[13];
    s[12] = tmp;
    const r = validateStickers(s);
    expect(r.issues.map((i) => i.code)).toContain('centers');
  });

  it('rejects an impossible edge (two colors that never share an edge)', () => {
    const s = faceletsToStickers(solvedFacelets(), STANDARD_SCHEME);
    // UF edge: make it white/yellow by swapping with a yellow sticker from DF edge (keeps counts)
    const [uf0, uf1] = EDGE_FACELETS[1];
    const [df0] = EDGE_FACELETS[5];
    [s[uf1], s[df0]] = [s[df0], s[uf1]];
    const r = validateStickers(s);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'invalid-edge')).toBe(true);
    expect(uf0).toBeDefined();
  });

  it('rejects a single flipped edge', () => {
    const s = scrambled();
    const [a, b] = EDGE_FACELETS[4];
    [s[a], s[b]] = [s[b], s[a]];
    expect(validateStickers(s).issues.map((i) => i.code)).toContain('edge-flip');
  });

  it('rejects a single twisted corner', () => {
    const s = scrambled();
    const [a, b, c] = CORNER_FACELETS[2];
    [s[a], s[b], s[c]] = [s[c], s[a], s[b]];
    expect(validateStickers(s).issues.map((i) => i.code)).toContain('corner-twist');
  });

  it('rejects a permutation parity violation (two edges swapped)', () => {
    const s = faceletsToStickers(solvedFacelets(), STANDARD_SCHEME);
    const [a0, a1] = EDGE_FACELETS[0];
    const [b0, b1] = EDGE_FACELETS[1];
    [s[a0], s[b0]] = [s[b0], s[a0]];
    [s[a1], s[b1]] = [s[b1], s[a1]];
    expect(validateStickers(s).issues.map((i) => i.code)).toContain('parity');
  });

  it('never mutates its input', () => {
    const s = scrambled();
    s[0] = null;
    const copy = [...s];
    validateStickers(s);
    expect(s).toEqual(copy);
  });

  it('suggests (but does not apply) a face rotation for a face scanned at the wrong angle', () => {
    const good = scrambled();
    const bad: StickerArray = rotateFaceStickers(good, 0, 1); // U scanned 90° off
    expect(validateStickers(bad).ok).toBe(false);
    const sugg = suggestFaceRotations(bad);
    expect(sugg.length).toBeGreaterThan(0);
    expect(sugg.some((s) => s.stickers.join() === good.join())).toBe(true);
  });
});
