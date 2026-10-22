/** Face letters in canonical Kociemba / cubejs order. */
export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
export type Face = (typeof FACES)[number];

export const COLORS = ['white', 'yellow', 'red', 'orange', 'green', 'blue'] as const;
export type ColorName = (typeof COLORS)[number];

/** A sticker that has not been assigned a color yet (manual entry / unscanned). */
export type Sticker = ColorName | null;

/** 54 stickers in URFDLB facelet order: index = 9 * faceIndex + 3 * row + col. */
export type StickerArray = Sticker[];

export const FACE_NAMES: Record<Face, string> = {
  U: 'Up',
  R: 'Right',
  F: 'Front',
  D: 'Down',
  L: 'Left',
  B: 'Back',
};

export const COLOR_HEX: Record<ColorName, string> = {
  white: '#f4f6fb',
  yellow: '#ffd500',
  red: '#e0201b',
  orange: '#ff7a00',
  green: '#00a650',
  blue: '#1e5bd8',
};

export const UNKNOWN_HEX = '#3a4157';

/** Standard Western color scheme, used for the demo cube and manual entry defaults. */
export const STANDARD_SCHEME: Record<Face, ColorName> = {
  U: 'white',
  R: 'red',
  F: 'green',
  D: 'yellow',
  L: 'orange',
  B: 'blue',
};

/** Opposite colors in the standard scheme — used for scan sanity hints only. */
export const OPPOSITE_COLOR: Record<ColorName, ColorName> = {
  white: 'yellow',
  yellow: 'white',
  red: 'orange',
  orange: 'red',
  green: 'blue',
  blue: 'green',
};

export const OPPOSITE_FACE: Record<Face, Face> = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };

export function faceIndex(f: Face): number {
  return FACES.indexOf(f);
}

export function idx(face: Face, row: number, col: number): number {
  return 9 * faceIndex(face) + 3 * row + col;
}

export function solvedFacelets(): string {
  return FACES.map((f) => f.repeat(9)).join('');
}

export function schemeStickers(scheme: Record<Face, ColorName> = STANDARD_SCHEME): StickerArray {
  return FACES.flatMap((f) => Array<Sticker>(9).fill(scheme[f]));
}
