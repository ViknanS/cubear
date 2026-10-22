import { COLOR_HEX, FACES, FACE_NAMES, UNKNOWN_HEX, type Face, type StickerArray } from '../cube/types';

interface Props {
  stickers: StickerArray;
  onSticker?: (index: number) => void;
  onRotateFace?: (face: number) => void;
  problem?: Set<number>;
  uncertain?: Set<number>;
  compact?: boolean;
  activeFace?: Face | null;
}

// cross layout:   . U . .
//                 L F R B
//                 . D . .
const POS: Record<Face, [number, number]> = { U: [0, 1], L: [1, 0], F: [1, 1], R: [1, 2], B: [1, 3], D: [2, 1] };

/** Unfolded cube net with all 54 stickers. Tappable when onSticker is provided. */
export function CubeNet({ stickers, onSticker, onRotateFace, problem, uncertain, compact, activeFace }: Props) {
  return (
    <div
      className="grid w-full mx-auto select-none"
      style={{ gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(3, auto)', gap: compact ? 3 : 6, maxWidth: compact ? 260 : 440 }}
      data-testid="cube-net"
    >
      {FACES.map((f, fi) => (
        <div
          key={f}
          className={`relative rounded-lg p-[3px] ${activeFace === f ? 'ring-2 ring-[var(--accent)]' : ''}`}
          style={{ gridRow: POS[f][0] + 1, gridColumn: POS[f][1] + 1, background: 'rgba(5,8,20,0.65)' }}
        >
          <div className="grid grid-cols-3 gap-[2px]">
            {Array.from({ length: 9 }, (_, k) => {
              const i = 9 * fi + k;
              const s = stickers[i];
              const bad = problem?.has(i);
              const unsure = uncertain?.has(i);
              return (
                <button
                  key={k}
                  type="button"
                  disabled={!onSticker}
                  onClick={() => onSticker?.(i)}
                  aria-label={`${FACE_NAMES[f]} face sticker ${k + 1}: ${s ?? 'unset'}`}
                  data-testid={`sticker-${i}`}
                  data-color={s ?? 'none'}
                  className={`aspect-square rounded-[4px] transition-transform ${onSticker ? 'active:scale-90 cursor-pointer' : ''} ${bad ? 'outline outline-2 outline-offset-1 outline-[var(--danger)]' : ''} ${unsure ? 'animate-pulse outline outline-2 outline-offset-1 outline-amber-300' : ''}`}
                  style={{ background: s ? COLOR_HEX[s] : UNKNOWN_HEX, boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.25)' }}
                >
                  {k === 4 && !compact && <span className="text-[9px] font-bold text-black/50">{f}</span>}
                </button>
              );
            })}
          </div>
          {onRotateFace && (
            <button
              type="button"
              onClick={() => onRotateFace(fi)}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full glass text-[11px] leading-none"
              aria-label={`Rotate ${FACE_NAMES[f]} face 90° clockwise`}
              title="Rotate this face 90°"
            >
              ↻
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
