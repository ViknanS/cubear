import { faceletsToStickers } from '../cube/convert';
import { applyMovesToString, parseAlgorithm } from '../cube/moves';
import { STANDARD_SCHEME, solvedFacelets, type StickerArray } from '../cube/types';

/** A fixed, known-valid scramble used by "Try Demo". */
export const DEMO_SCRAMBLE = "R U2 F' L D2 B R' U' F2 L2 D B2 U R2 F";

export function demoStickers(): StickerArray {
  return faceletsToStickers(applyMovesToString(solvedFacelets(), parseAlgorithm(DEMO_SCRAMBLE)), STANDARD_SCHEME);
}
