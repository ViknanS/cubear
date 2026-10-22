import { COLORS, type ColorName } from '../cube/types';

export type Lab = [number, number, number];

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);

/** sRGB (0–255) → CIE L*a*b* (D65). Lab separates lightness from chroma, which makes it robust to brightness changes. */
export function rgbToLab(r: number, g: number, b: number): Lab {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  const X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const Z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labToRgb([L, a, b]: Lab): [number, number, number] {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inv = (t: number) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
  const X = inv(fx) * 0.95047, Y = inv(fy), Z = inv(fz) * 1.08883;
  const lin = [
    X * 3.2404542 - Y * 1.5371385 - Z * 0.4985314,
    -X * 0.969266 + Y * 1.8760108 + Z * 0.041556,
    X * 0.0556434 - Y * 0.2040259 + Z * 1.0572252,
  ];
  return lin.map((v) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(1, c)) * 255);
  }) as [number, number, number];
}

/** Typical camera-captured sticker colors under neutral indoor light. Used until centers calibrate the palette. */
export const DEFAULT_RGB: Record<ColorName, [number, number, number]> = {
  white: [222, 225, 228],
  yellow: [232, 205, 40],
  red: [185, 28, 38],
  orange: [242, 108, 28],
  green: [22, 155, 78],
  blue: [18, 78, 178],
};

export type Prototypes = Record<ColorName, Lab>;

export function defaultPrototypes(): Prototypes {
  return Object.fromEntries(COLORS.map((c) => [c, rgbToLab(...DEFAULT_RGB[c])])) as Prototypes;
}

/**
 * Perceptual distance tuned for stickers: lightness is down-weighted (shadows/exposure change it most),
 * while hue/chroma (a*, b*) carry the color identity. White is the one color recognised mostly by low chroma.
 */
export function colorDistance(p: Lab, q: Lab): number {
  const dL = (p[0] - q[0]) * 0.45;
  const da = p[1] - q[1];
  const db = p[2] - q[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}

export interface Classification {
  color: ColorName;
  /** 0 = ambiguous between two colors, 1 = unambiguous. */
  confidence: number;
  distance: number;
  runnerUp: ColorName;
}

export function classify(lab: Lab, protos: Prototypes): Classification {
  let best: ColorName = 'white', second: ColorName = 'white';
  let d1 = Infinity, d2 = Infinity;
  for (const c of COLORS) {
    const d = colorDistance(lab, protos[c]);
    if (d < d1) { d2 = d1; second = best; d1 = d; best = c; }
    else if (d < d2) { d2 = d; second = c; }
  }
  return { color: best, confidence: d2 === 0 ? 0 : Math.max(0, 1 - d1 / d2), distance: d1, runnerUp: second };
}

export const MIN_CONFIDENCE = 0.2;
