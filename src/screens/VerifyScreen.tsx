import { useMemo, useState } from 'react';
import { Cube3D } from '../components/Cube3D';
import { CubeNet } from '../components/CubeNet';
import { ColorPalette } from '../components/FaceEditor';
import { Header, Panel } from '../components/ui';
import { colorCounts } from '../cube/convert';
import { COLORS, COLOR_HEX, FACES, FACE_NAMES, type ColorName, type Face } from '../cube/types';
import { rotateFaceStickers, suggestFaceRotations, validateStickers } from '../cube/validate';
import { solveInWorker } from '../solver/solverClient';
import { useApp } from '../state/store';
import { sounds } from '../feedback';

export function VerifyScreen() {
  const stickers = useApp((s) => s.stickers);
  const setSticker = useApp((s) => s.setSticker);
  const setStickers = useApp((s) => s.setStickers);
  const lowConfidence = useApp((s) => s.lowConfidence);
  const source = useApp((s) => s.source);
  const go = useApp((s) => s.go);
  const setRescanFace = useApp((s) => s.setRescanFace);
  const setSolution = useApp((s) => s.setSolution);
  const sound = useApp((s) => s.settings.sound);

  const [paint, setPaint] = useState<ColorName | null>(source === 'manual' ? 'white' : null);
  const [picked, setPicked] = useState<number | null>(null);
  const [solving, setSolving] = useState(false);
  const [solveError, setSolveError] = useState<string | null>(null);

  const result = useMemo(() => validateStickers(stickers), [stickers]);
  const counts = useMemo(() => colorCounts(stickers), [stickers]);
  const problem = useMemo(() => new Set(result.issues.filter((i) => i.stickers.length <= 12).flatMap((i) => i.stickers)), [result]);
  const suggestion = useMemo(() => {
    const structural = result.issues.some((i) => ['invalid-corner', 'invalid-edge', 'duplicate-corner', 'duplicate-edge', 'corner-twist', 'edge-flip', 'parity'].includes(i.code));
    if (!structural) return null;
    return suggestFaceRotations(stickers)[0] ?? null;
  }, [result, stickers]);

  const onSticker = (i: number) => {
    if (paint) setSticker(i, paint);
    else setPicked(i);
  };

  const rotateFace = (fi: number) => setStickers(rotateFaceStickers(stickers, fi, 1), undefined, lowConfidence);

  const solve = async () => {
    if (!result.ok || !result.facelets) return;
    setSolving(true);
    setSolveError(null);
    try {
      const out = await solveInWorker(result.facelets);
      setSolution({ moves: out.moves, facelets: result.facelets, ms: out.ms });
      go('solution');
    } catch (e) {
      setSolveError((e as Error).message);
      if (sound) sounds.error();
    } finally {
      setSolving(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col fade-in">
      <Header title={source === 'manual' ? 'Enter your cube' : 'Check your cube'} />
      <div className="px-4 pb-32 flex flex-col gap-4 max-w-3xl w-full mx-auto">
        <div className="grid md:grid-cols-2 gap-4">
          <Panel>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">Cube net · 54 stickers</h2>
              <span className="text-xs text-[var(--muted)]">{paint ? 'Tap stickers to paint' : 'Tap a sticker to fix it'}</span>
            </div>
            <CubeNet stickers={stickers} onSticker={onSticker} onRotateFace={rotateFace} problem={problem} uncertain={new Set(lowConfidence)} />
            <div className="mt-4">
              <ColorPalette value={paint} onChange={(c) => setPaint((p) => (p === c ? null : c))} />
              <div className="flex justify-center gap-3 mt-3 text-[11px] text-[var(--muted)] flex-wrap">
                {COLORS.map((c) => (
                  <span key={c} className={counts[c] !== 9 ? 'text-[var(--danger)] font-semibold' : ''}>
                    <span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: COLOR_HEX[c] }} />
                    {counts[c]}/9
                  </span>
                ))}
              </div>
            </div>
          </Panel>

          <Panel className="flex flex-col">
            <h2 className="font-semibold text-sm mb-1">3D reconstruction</h2>
            <p className="text-xs text-[var(--muted)] mb-2">Drag to rotate · pinch to zoom</p>
            <Cube3D stickers={stickers} interactive className="w-full h-64 md:flex-1" label="Rotatable 3D reconstruction" />
          </Panel>
        </div>

        <Panel>
          <h2 className="font-semibold text-sm mb-2">Validation</h2>
          {result.ok ? (
            <p className="text-sm text-[var(--ok)]" data-testid="validation-ok">✓ This is a real, solvable cube state. Check it matches your physical cube, then solve.</p>
          ) : (
            <ul className="text-sm flex flex-col gap-2" data-testid="validation-issues">
              {result.issues.map((i, k) => (
                <li key={k} className="flex gap-2"><span className="text-[var(--danger)]">●</span><span>{i.message}</span></li>
              ))}
            </ul>
          )}
          {lowConfidence.length > 0 && <p className="text-xs text-amber-300 mt-2">Pulsing stickers were hard to read — double-check them.</p>}
          {suggestion && (
            <div className="mt-3 p-3 rounded-2xl border border-[var(--border)] text-sm">
              A face may have been held at the wrong angle. Rotating{' '}
              <b>{suggestion.rotations.map((q, f) => (q ? `${FACE_NAMES[FACES[f]]} by ${q * 90}°` : null)).filter(Boolean).join(', ')}</b> gives a valid cube.
              <div className="mt-2"><button className="btn btn-ghost !min-h-[38px] text-sm" onClick={() => setStickers(suggestion.stickers, undefined, lowConfidence)}>Apply this fix</button></div>
            </div>
          )}
        </Panel>

        {source !== 'demo' && (
          <Panel>
            <h2 className="font-semibold text-sm mb-2">Rescan a face</h2>
            <div className="flex flex-wrap gap-2">
              {FACES.map((f: Face) => (
                <button key={f} className="btn btn-ghost !min-h-[40px] text-sm" onClick={() => { setRescanFace(f); go('scan'); }}>
                  <span className="w-3 h-3 rounded-sm" style={{ background: stickers[9 * FACES.indexOf(f) + 4] ? COLOR_HEX[stickers[9 * FACES.indexOf(f) + 4]!] : '#555' }} />
                  {FACE_NAMES[f]}
                </button>
              ))}
            </div>
          </Panel>
        )}
      </div>

      {picked !== null && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-end justify-center p-3" onClick={() => setPicked(null)}>
          <div className="glass-strong rounded-3xl p-5 w-full max-w-sm safe-bottom fade-in" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Choose sticker color">
            <p className="text-sm mb-3">Set this sticker to:</p>
            <ColorPalette value={stickers[picked]} onChange={(c) => { setSticker(picked, c); setPicked(null); }} />
          </div>
        </div>
      )}

      <div className="fixed bottom-0 inset-x-0 z-30 px-4 safe-bottom pt-3 glass-strong !border-x-0 !border-b-0">
        {solveError && <p className="text-sm text-[var(--danger)] mb-2 max-w-3xl mx-auto">{solveError}</p>}
        <div className="max-w-3xl mx-auto flex gap-3">
          <button className="btn btn-primary flex-1 h-14" onClick={solve} disabled={!result.ok || solving} data-testid="solve">
            {solving ? 'Calculating solution…' : 'Confirm & Solve'}
          </button>
        </div>
      </div>
    </main>
  );
}
