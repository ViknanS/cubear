/**
 * Deterministic synthetic camera frames of one cube face, for computer-vision tests.
 * Each fixture renders a black cube body with 9 colored stickers under a chosen perspective, exposure,
 * color temperature, light gradient, sensor noise and optional specular glare.
 */
import type { ColorName } from '../../src/cube/types';
import { applyH, computeHomography, type Pt } from '../../src/vision/homography';
import type { RGBAImage } from '../../src/vision/image';

export const STICKER_RGB: Record<ColorName, [number, number, number]> = {
  white: [226, 229, 232],
  yellow: [236, 207, 34],
  red: [186, 26, 38],
  orange: [246, 106, 24],
  green: [20, 156, 76],
  blue: [16, 76, 176],
};

export interface SynthOptions {
  width?: number;
  height?: number;
  colors: ColorName[]; // 9, row-major as seen in the image (top-left first)
  quad: Pt[]; // face corners [TL, TR, BR, BL]
  gain?: number; // overall exposure
  tint?: [number, number, number]; // white balance multiplier (e.g. warm light)
  gradient?: number; // left→right light falloff
  noise?: number; // ± noise amplitude
  glare?: { cell: number; strength: number };
  seed?: number;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) / 4294967296);
  };
}

export function renderFace(o: SynthOptions): RGBAImage {
  const W = o.width ?? 320, Hh = o.height ?? 240;
  const H = computeHomography(o.quad, [[0, 0], [3, 0], [3, 3], [0, 3]])!;
  const rand = rng(o.seed ?? 7);
  const gain = o.gain ?? 1, tint = o.tint ?? [1, 1, 1], grad = o.gradient ?? 0, noise = o.noise ?? 6;
  const data = new Uint8ClampedArray(W * Hh * 4);
  for (let y = 0; y < Hh; y++)
    for (let x = 0; x < W; x++) {
      const [u, v] = applyH(H, [x + 0.5, y + 0.5]);
      let rgb: [number, number, number];
      if (u >= -0.08 && u <= 3.08 && v >= -0.08 && v <= 3.08) {
        const cu = Math.floor(u), cv = Math.floor(v);
        const fu = u - cu, fv = v - cv;
        const inside = cu >= 0 && cu < 3 && cv >= 0 && cv < 3 && fu > 0.07 && fu < 0.93 && fv > 0.07 && fv < 0.93;
        if (inside) {
          const cell = cv * 3 + cu;
          rgb = [...STICKER_RGB[o.colors[cell]]];
          if (o.glare && o.glare.cell === cell) {
            const dd = Math.hypot(fu - 0.62, fv - 0.38);
            const k = Math.max(0, 1 - dd / 0.18) * o.glare.strength;
            rgb = rgb.map((c) => c + (255 - c) * k) as [number, number, number];
          }
        } else rgb = [24, 24, 27]; // black plastic
      } else {
        // textured tabletop background
        const t = 120 + 30 * Math.sin(x / 23) * Math.cos(y / 31);
        rgb = [t * 0.85, t * 0.75, t * 0.62];
      }
      const light = gain * (1 + grad * (x / W - 0.5));
      const i = (y * W + x) * 4;
      for (let ch = 0; ch < 3; ch++) data[i + ch] = rgb[ch] * light * tint[ch] + (rand() * 2 - 1) * noise;
      data[i + 3] = 255;
    }
  return { data, width: W, height: Hh };
}

/** A centred, axis-aligned quad of side s. */
export const frontal = (cx = 160, cy = 120, s = 150): Pt[] => [[cx - s / 2, cy - s / 2], [cx + s / 2, cy - s / 2], [cx + s / 2, cy + s / 2], [cx - s / 2, cy + s / 2]];

export const rotated = (deg: number, cx = 160, cy = 120, s = 140): Pt[] =>
  frontal(0, 0, s).map(([x, y]) => {
    const a = (deg * Math.PI) / 180;
    return [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)] as Pt;
  });

/** Viewed from below-left: a trapezoid with perspective foreshortening. */
export const perspective = (): Pt[] => [[100, 52], [228, 62], [240, 196], [86, 182]];

export interface Fixture {
  name: string;
  opts: SynthOptions;
}

const FACE: ColorName[] = ['red', 'white', 'blue', 'orange', 'green', 'yellow', 'white', 'red', 'orange'];

export const FIXTURES: Fixture[] = [
  { name: 'frontal-neutral', opts: { colors: FACE, quad: frontal() } },
  { name: 'perspective-tilt', opts: { colors: FACE, quad: perspective(), seed: 3 } },
  { name: 'rotated-18deg', opts: { colors: FACE, quad: rotated(18), seed: 4 } },
  { name: 'dim-light', opts: { colors: FACE, quad: frontal(), gain: 0.55, noise: 8, seed: 5 } },
  { name: 'warm-tungsten', opts: { colors: FACE, quad: frontal(), tint: [1.08, 0.94, 0.72], seed: 6 } },
  { name: 'side-gradient', opts: { colors: FACE, quad: frontal(), gradient: 0.7, seed: 8 } },
  { name: 'glare-on-sticker', opts: { colors: FACE, quad: frontal(), glare: { cell: 4, strength: 0.9 }, seed: 9 } },
  { name: 'small-far-away', opts: { colors: FACE, quad: frontal(160, 120, 84), seed: 10 } },
];
export const FIXTURE_FACE = FACE;
