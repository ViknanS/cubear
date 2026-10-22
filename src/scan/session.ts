import { FACES, OPPOSITE_COLOR, type ColorName, type Face, type StickerArray } from '../cube/types';
import { calibrateCube } from '../vision/calibrate';
import type { Lab } from '../vision/color';

/** Scan order and how the cube is held for each scan (see ORIENTATION_STEPS for the user-facing text). */
export const SCAN_ORDER: Face[] = ['F', 'R', 'B', 'L', 'U', 'D'];

export interface OrientationStep {
  face: Face;
  title: string;
  instruction: string;
  /** Whole-cube rotation (Euler XYZ, radians) that brings this face toward the camera, for the 3D guide. */
  euler: [number, number, number];
  /** Which face's stickers appear at the top edge of the camera image. */
  topNeighbour: Face;
}

const Q = Math.PI / 2;
export const ORIENTATION_STEPS: OrientationStep[] = [
  {
    face: 'F',
    title: 'Front face',
    instruction: 'Hold the cube with any face toward the camera. Note the center color on TOP — keep that color on top for the next four scans.',
    euler: [0, 0, 0],
    topNeighbour: 'U',
  },
  {
    face: 'R',
    title: 'Right face',
    instruction: 'Turn the whole cube a quarter turn to the LEFT, so its right side now faces the camera. The top color stays on top.',
    euler: [0, -Q, 0],
    topNeighbour: 'U',
  },
  {
    face: 'B',
    title: 'Back face',
    instruction: 'Turn the whole cube another quarter turn to the LEFT. The top color stays on top.',
    euler: [0, -2 * Q, 0],
    topNeighbour: 'U',
  },
  {
    face: 'L',
    title: 'Left face',
    instruction: 'Turn the whole cube another quarter turn to the LEFT. The top color stays on top.',
    euler: [0, -3 * Q, 0],
    topNeighbour: 'U',
  },
  {
    face: 'U',
    title: 'Top face',
    instruction: 'Turn LEFT once more so the first face is in front again. Then tip the top of the cube TOWARD the camera, so the top face looks at the camera and the first face is at the bottom of the view.',
    euler: [Q, 0, 0],
    topNeighbour: 'B',
  },
  {
    face: 'D',
    title: 'Bottom face',
    instruction: 'Tip the cube back a half turn the other way, so the bottom face looks at the camera and the first face is now at the TOP of the view.',
    euler: [-Q, 0, 0],
    topNeighbour: 'F',
  },
];

export interface CapturedFace {
  face: Face;
  samples: Lab[]; // 9, row-major exactly as the face appears in the image
  colors: ColorName[]; // live classification at capture time
  confidence: number[];
  /** 'auto' = OpenCV grid, 'guide' = fixed guide box, 'manual' = typed in */
  source: 'auto' | 'guide' | 'manual';
}

export type ScanCaptures = Partial<Record<Face, CapturedFace>>;

export function nextFaceToScan(c: ScanCaptures): Face | null {
  return SCAN_ORDER.find((f) => !c[f]) ?? null;
}

export function scannedCount(c: ScanCaptures): number {
  return SCAN_ORDER.filter((f) => c[f]).length;
}

/**
 * Because the orientation protocol puts each face in front of the camera with the correct neighbour on top
 * (U on top for F/R/B/L, B on top for U, F on top for D), the image's row-major order is exactly the
 * Kociemba facelet order for that face — no extra rotation is needed.
 */
export function assembleStickers(c: ScanCaptures): StickerArray {
  return FACES.flatMap((f) => c[f]?.colors ?? Array(9).fill(null));
}

/** Once all six faces are captured, re-assign every sticker using the six centers as this cube's palette. */
export function calibratedStickers(c: ScanCaptures): { stickers: StickerArray; lowConfidence: number[] } | null {
  if (scannedCount(c) < 6) return null;
  const allAuto = FACES.every((f) => c[f]!.source !== 'manual');
  if (!allAuto) {
    // Manually typed faces have no color samples; keep live colors as-is.
    return { stickers: assembleStickers(c), lowConfidence: [] };
  }
  const samples = FACES.flatMap((f) => c[f]!.samples);
  const cal = calibrateCube(samples);
  return { stickers: cal.colors, lowConfidence: cal.confidence.map((v, i) => (v < 0.15 ? i : -1)).filter((i) => i >= 0) };
}

/**
 * Sanity hints during scanning — catches the most common orientation mistakes before the user reaches validation.
 */
export function scanWarning(c: ScanCaptures, face: Face, centerColor: ColorName): string | null {
  for (const f of SCAN_ORDER) {
    const cap = c[f];
    if (cap && f !== face && cap.colors[4] === centerColor) {
      return `This looks like the face you already scanned as "${f}" (${centerColor} center). Follow the turn shown above.`;
    }
  }
  const front = c.F?.colors[4];
  if (front && (face === 'R' || face === 'L' || face === 'U' || face === 'D') && OPPOSITE_COLOR[front] === centerColor) {
    return `A ${centerColor} center is usually opposite ${front} — this may be the back face. Check the turn direction.`;
  }
  return null;
}
