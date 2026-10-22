import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCamera } from '../camera/useCamera';
import { useFaceTracker, type FrameResult, type TrackMode } from '../camera/useFaceTracker';
import { drawDetectionGrid, prepareCanvas, videoToScreen } from '../ar/overlay';
import { CameraFallback } from '../components/CameraFallback';
import { Cube3D, type Cube3DHandle } from '../components/Cube3D';
import { FaceEditor } from '../components/FaceEditor';
import { ProgressBar } from '../components/ui';
import { COLOR_HEX, FACE_NAMES, UNKNOWN_HEX, type Face } from '../cube/types';
import { sounds } from '../feedback';
import { assembleStickers, calibratedStickers, nextFaceToScan, ORIENTATION_STEPS, SCAN_ORDER, scanWarning, scannedCount, type ScanCaptures } from '../scan/session';
import { useApp } from '../state/store';
import { MIN_CONFIDENCE } from '../vision/color';
import { prototypesFromCenters } from '../vision/calibrate';

export function ScanScreen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const guideCube = useRef<Cube3DHandle>(null);

  const captures = useApp((s) => s.captures);
  const setCapture = useApp((s) => s.setCapture);
  const rescanFace = useApp((s) => s.rescanFace);
  const setRescanFace = useApp((s) => s.setRescanFace);
  const setStickers = useApp((s) => s.setStickers);
  const stickers = useApp((s) => s.stickers);
  const go = useApp((s) => s.go);
  const back = useApp((s) => s.back);
  const sound = useApp((s) => s.settings.sound);

  const [mode, setMode] = useState<TrackMode>('auto');
  const [editing, setEditing] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [flash, setFlash] = useState(false);

  const face: Face | null = rescanFace ?? nextFaceToScan(captures);
  const step = ORIENTATION_STEPS.find((s) => s.face === face) ?? ORIENTATION_STEPS[0];
  const done = scannedCount(captures);

  const cam = useCamera(videoRef, true);
  const protos = useMemo(
    () => prototypesFromCenters(SCAN_ORDER.filter((f) => captures[f] && captures[f]!.source !== 'manual').map((f) => ({ color: captures[f]!.colors[4], lab: captures[f]!.samples[4] }))),
    [captures],
  );

  const onFrame = useCallback((r: FrameResult) => {
    const v = videoRef.current, c = canvasRef.current, st = stageRef.current;
    if (!v || !c || !st) return;
    const ctx = prepareCanvas(c);
    if (!r.quad) return;
    const map = videoToScreen(v, st);
    drawDetectionGrid(ctx, r.quad.map(map), r.colors, r.confidence, r.stable);
  }, []);

  const tracker = useFaceTracker(videoRef, { enabled: cam.status === 'live' && !editing, mode, protos, onFrame });
  const r = tracker.result;
  useEffect(() => { if (tracker.cvState === 'failed') setMode('guide'); }, [tracker.cvState]);

  // 3D orientation guide: show the scanned colors so far, turned to the face being scanned.
  const guideStickers = useMemo(() => assembleStickers(captures), [captures]);
  useEffect(() => {
    if (!step) return;
    const t = setTimeout(() => {
      guideCube.current?.orient(step.euler);
      const fi = ['U', 'R', 'F', 'D', 'L', 'B'].indexOf(step.face);
      guideCube.current?.highlightStickers(Array.from({ length: 9 }, (_, k) => 9 * fi + k)); // face to scan stays bright
    }, 50);
    return () => clearTimeout(t);
  }, [step]);

  const warning = r?.colors ? scanWarning(rescanFace ? { ...captures, [rescanFace]: undefined } : captures, face ?? 'F', r.colors[4]) : null;
  const duplicate = !!warning && warning.includes('already scanned');
  const uncertain = r?.confidence?.filter((c) => c < MIN_CONFIDENCE).length ?? 0;
  const canCapture = !!(cam.status === 'live' && face && r?.stable && r.colors && r.labs && !duplicate);

  let status = '';
  if (cam.status !== 'live') status = '';
  else if (mode === 'auto' && tracker.cvState === 'loading') status = 'Loading the vision engine… (you can use Guide mode meanwhile)';
  else if (!r?.quad) status = 'Move closer and align one cube face inside the guide.';
  else if (r.lowLight) status = 'It’s quite dark — add light' + (cam.torch.supported ? ' or turn on the torch.' : '.');
  else if (duplicate) status = warning!;
  else if (uncertain) status = `Hold steady — ${uncertain} sticker${uncertain > 1 ? 's' : ''} uncertain (glare or shadow?).`;
  else if (!r.stable) status = 'Hold steady…';
  else status = warning ?? 'Looks good — capture this face.';

  const finishCapture = (next: ScanCaptures) => {
    if (rescanFace) {
      const cal = calibratedStickers(next);
      if (cal) setStickers(cal.stickers, 'scan', cal.lowConfidence);
      else {
        const s = stickers.slice();
        const fi = ['U', 'R', 'F', 'D', 'L', 'B'].indexOf(rescanFace);
        next[rescanFace]!.colors.forEach((c, k) => (s[9 * fi + k] = c));
        setStickers(s, 'scan');
      }
      setRescanFace(null);
      go('verify');
      return;
    }
    if (scannedCount(next) === 6) {
      const cal = calibratedStickers(next)!;
      setStickers(cal.stickers, 'scan', cal.lowConfidence);
      go('verify');
    }
  };

  const capture = () => {
    if (!canCapture || !r?.colors || !r.labs || !face) return;
    const cap = { face, samples: r.labs, colors: r.colors, confidence: r.confidence ?? [], source: r.mode };
    setCapture(face, cap);
    if (sound) sounds.capture();
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    finishCapture({ ...captures, [face]: cap });
  };

  const saveManual = (colors: import('../cube/types').ColorName[]) => {
    if (!face) return;
    const cap = { face, samples: [], colors, confidence: colors.map(() => 1), source: 'manual' as const };
    setCapture(face, cap);
    setEditing(false);
    finishCapture({ ...captures, [face]: cap });
  };

  const cameraBroken = !['live', 'starting', 'idle', 'paused'].includes(cam.status);

  return (
    <main className="fixed inset-0 bg-black text-white flex flex-col">
      <div ref={stageRef} className="absolute inset-0">
        <video ref={videoRef} className="camera" playsInline muted autoPlay aria-label="Live camera" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        {/* aiming guide */}
        {cam.status === 'live' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="relative rounded-3xl"
              style={{ width: 'min(64vw, 46vh)', aspectRatio: '1', border: `2px ${mode === 'guide' ? 'solid' : 'dashed'} rgba(255,255,255,${mode === 'guide' ? 0.9 : 0.35})` }}
            >
              {mode === 'guide' && (
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }).map((_, i) => <div key={i} className="border border-white/25" />)}
                </div>
              )}
              {!r?.quad && <div className="absolute inset-x-4 top-1/2 h-0.5 scan-line" style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }} />}
            </div>
          </div>
        )}
        {flash && <div className="absolute inset-0 bg-white/40 pointer-events-none" />}
        {cameraBroken && <CameraFallback status={cam.status} onRetry={cam.retry} onManual={() => { setStickers(assembleStickers(captures), 'manual'); go('verify'); }} />}
        {cam.status === 'starting' && <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">Starting camera…</div>}
      </div>

      {/* top HUD */}
      <div className="relative z-10 safe-top px-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-icon !bg-black/40" onClick={() => { setRescanFace(null); back(); }} aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div className="flex-1 glass rounded-2xl px-3 py-2 !bg-black/40">
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold" data-testid="scan-progress">{rescanFace ? `Rescanning ${FACE_NAMES[rescanFace]} face` : `Face ${Math.min(done + 1, 6)} of 6 · ${done} scanned`}</span>
              <span className="opacity-80">{face ? step.title : ''}</span>
            </div>
            <ProgressBar value={done / 6} label="Scanning progress" />
          </div>
          <button
            className="btn btn-ghost !min-h-[44px] !px-3 text-xs !bg-black/40"
            onClick={() => setMode((m) => (m === 'auto' ? 'guide' : 'auto'))}
            disabled={tracker.cvState === 'failed' && mode === 'guide'}
            aria-label="Switch detection mode"
            title={mode === 'auto' ? 'Automatic OpenCV face detection' : 'Fixed guide box (align the face inside the square)'}
          >
            {mode === 'auto' ? 'Auto' : 'Guide'}
          </button>
        </div>

        {showGuide && face && (
          <div className="glass rounded-2xl p-3 flex gap-3 items-center !bg-black/50 fade-in">
            <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-black/30">
              <Cube3D ref={guideCube} stickers={guideStickers} zoom={0.85} className="w-full h-full" label="How to hold the cube" />
            </div>
            <div className="text-[13px] leading-snug flex-1">
              <div className="font-semibold mb-0.5">Step {SCAN_ORDER.indexOf(face) + 1}: {step.title}</div>
              <div className="opacity-90">{step.instruction}</div>
            </div>
            <button className="self-start text-white/60 px-1" onClick={() => setShowGuide(false)} aria-label="Hide instructions">✕</button>
          </div>
        )}
        {!showGuide && <button className="self-start chip glass !bg-black/50" onClick={() => setShowGuide(true)}>Show how to hold the cube</button>}
      </div>

      <div className="flex-1" />

      {/* bottom HUD */}
      <div className="relative z-10 px-3 safe-bottom flex flex-col gap-3">
        <div className="glass rounded-2xl p-3 !bg-black/55">
          <div className="flex items-center gap-3">
            <div className="grid grid-cols-3 gap-1 w-16 shrink-0 p-1 rounded-lg bg-black/60" aria-label="Detected colors">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-[3px]" style={{ background: r?.colors ? COLOR_HEX[r.colors[i]] : UNKNOWN_HEX, opacity: r?.confidence && r.confidence[i] < MIN_CONFIDENCE ? 0.4 : 1 }} />
              ))}
            </div>
            <div className="flex-1 text-[13px] leading-snug" aria-live="polite" data-testid="scan-status">
              {status}
              {r && r.quad && <div className="text-[11px] opacity-60 mt-1">{r.mode === 'auto' ? `Grid found · ${Math.round(r.detConfidence * 100)}% confidence` : 'Guide mode · align the face with the square'}</div>}
            </div>
            {cam.torch.supported && (
              <button className="btn btn-ghost btn-icon !bg-black/40" onClick={cam.toggleTorch} aria-label="Toggle torch">{cam.torch.on ? '🔦' : '💡'}</button>
            )}
          </div>
        </div>

        <div className="flex gap-3 items-center">
          <button className="btn btn-ghost !bg-black/40 flex-1 text-sm" onClick={() => setEditing(true)} disabled={!face}>Type colors</button>
          <button
            className="w-20 h-20 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 disabled:opacity-40"
            style={{ background: canCapture ? 'linear-gradient(135deg, var(--accent), var(--accent2))' : 'rgba(255,255,255,.15)', boxShadow: canCapture ? '0 0 0 6px rgba(79,124,255,.25)' : 'none' }}
            onClick={capture}
            disabled={!canCapture}
            aria-label="Capture face"
            data-testid="capture"
          >
            <span className="w-14 h-14 rounded-full border-4 border-white/90" />
          </button>
          <div className="flex-1 flex gap-1 justify-end flex-wrap">
            {SCAN_ORDER.map((f) => (
              <span key={f} className={`chip !px-2 ${captures[f] ? 'bg-emerald-500/80' : f === face ? 'bg-[var(--accent)]' : 'bg-white/10'}`} title={FACE_NAMES[f]}>{f}</span>
            ))}
          </div>
        </div>
      </div>

      {editing && face && (
        <FaceEditor title={`Type the ${FACE_NAMES[face]} face`} initial={captures[face]?.colors} onSave={saveManual} onCancel={() => setEditing(false)} />
      )}
    </main>
  );
}
