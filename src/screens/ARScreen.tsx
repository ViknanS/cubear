import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCamera } from '../camera/useCamera';
import { useFaceTracker, type FrameResult } from '../camera/useFaceTracker';
import { arrowFor, frontFace, matchFace, moveVerifiableFromFront, observeStep, StepVerifier } from '../ar/guide';
import { drawMoveArrow, prepareCanvas, videoToScreen } from '../ar/overlay';
import { CameraFallback } from '../components/CameraFallback';
import { Cube3D, type Cube3DHandle } from '../components/Cube3D';
import { ProgressBar, Toggle } from '../components/ui';
import { describeMove, frontViewHint, parseMove } from '../cube/moves';
import { COLOR_HEX, FACES, type ColorName } from '../cube/types';
import { sounds, speak, speechSupported } from '../feedback';
import { useSolutionPlayer } from '../hooks/useSolutionPlayer';
import { useApp } from '../state/store';
import { calibrateCube, prototypesFromCenters } from '../vision/calibrate';
import type { Pt } from '../vision/homography';

type Track =
  | { kind: 'searching' }
  | { kind: 'wrong-face'; seen: ColorName; want: ColorName; top: ColorName }
  | { kind: 'tracking'; matches: number; unique: boolean }
  | { kind: 'done-move' }
  | { kind: 'mismatch' };

interface Overlay { quad: Pt[]; rotation: number; t: number; show: boolean }

export function ARScreen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cube = useRef<Cube3DHandle>(null);
  const overlay = useRef<Overlay | null>(null);
  const verifier = useRef(new StepVerifier());

  const go = useApp((s) => s.go);
  const back = useApp((s) => s.back);
  const captures = useApp((s) => s.captures);
  const resetScan = useApp((s) => s.resetScan);
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const markFinished = useApp((s) => s.markFinished);

  const p = useSolutionPlayer(cube);
  const total = p.moves.length;
  const { stateAt, step } = p;
  const before = useMemo(() => stateAt(step), [stateAt, step]);
  const finished = p.step >= total;

  const [view, setView] = useState<'camera' | '3d'>('camera');
  const [paused, setPaused] = useState(false);
  const [track, setTrack] = useState<Track>({ kind: 'searching' });
  const [wrongMove, setWrongMove] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [frontVerified, setFrontVerified] = useState(false);

  const cam = useCamera(videoRef, view === 'camera');

  // Palette calibrated from this cube's own scan, if we have one.
  const protos = useMemo(() => {
    const faces = FACES.map((f) => captures[f]);
    if (faces.every((c) => c && c.source !== 'manual' && c.samples.length === 9)) return calibrateCube(faces.flatMap((c) => c!.samples)).prototypes;
    return prototypesFromCenters(faces.filter((c) => c && c.source !== 'manual' && c.samples.length === 9).map((c) => ({ color: c!.colors[4], lab: c!.samples[4] })));
  }, [captures]);

  const stepRef = useRef({ before, move: p.current, paused, autoAdvance: settings.autoAdvance, finished });
  stepRef.current = { before, move: p.current, paused, autoAdvance: settings.autoAdvance, finished };
  const nextRef = useRef(p.next);
  nextRef.current = p.next;

  const setTrackIfChanged = useCallback((t: Track) => {
    setTrack((old) => (JSON.stringify(old) === JSON.stringify(t) ? old : t));
  }, []);

  const onFrame = useCallback((r: FrameResult) => {
    const { before, move, paused, autoAdvance, finished } = stepRef.current;
    const v = videoRef.current, st = stageRef.current;
    if (!v || !st || paused) { overlay.current = null; return; }
    if (!r.quad || !r.colors) { overlay.current = null; setTrackIfChanged({ kind: 'searching' }); return; }
    const quad = r.quad.map(videoToScreen(v, st));
    const want = before[22] as ColorName;
    if (finished) {
      const solvedFace = r.colors.every((c) => c === r.colors![4]);
      if (solvedFace && r.stable) setFrontVerified(true);
      overlay.current = null;
      return;
    }
    if (r.colors[4] !== want) {
      overlay.current = null;
      setTrackIfChanged({ kind: 'wrong-face', seen: r.colors[4], want, top: before[4] as ColorName });
      return;
    }
    if (!move) return;
    const o = observeStep(r.colors, before, move);
    const m = matchFace(r.colors, frontFace(before));
    if (o.obs === 'after') {
      overlay.current = null;
      setTrackIfChanged({ kind: 'done-move' });
    } else if (o.obs === 'mismatch') {
      overlay.current = null;
      setTrackIfChanged({ kind: 'mismatch' });
    } else {
      overlay.current = { quad, rotation: m.unique ? m.rotation : 0, t: performance.now(), show: true };
      setTrackIfChanged({ kind: 'tracking', matches: m.matches, unique: m.unique });
    }
    if (r.stable || o.obs !== 'after') {
      const verdict = verifier.current.push(o.obs);
      if (verdict === 'advance' && autoAdvance && moveVerifiableFromFront(before, move)) void nextRef.current();
      if (verdict === 'wrong-move') setWrongMove(true);
    }
  }, [setTrackIfChanged]);

  const tracker = useFaceTracker(videoRef, { enabled: view === 'camera' && cam.status === 'live', mode: 'auto', protos, onFrame });

  // 60 fps draw loop for smooth arrows; hides the overlay when tracking is stale (cube left the frame).
  useEffect(() => {
    if (view !== 'camera') return;
    let raf = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      const c = canvasRef.current;
      if (!c) return;
      const ctx = prepareCanvas(c);
      const o = overlay.current;
      const move = stepRef.current.move;
      if (!o || !move || t - o.t > 450) return;
      drawMoveArrow(ctx, o.quad, arrowFor(move), o.rotation, t);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [view]);

  // per-step side effects
  useEffect(() => {
    verifier.current.reset();
    setWrongMove(false);
    if (p.current && settings.speech) speak(`Step ${p.step + 1}. ${describeMove(p.current)}`);
    if (finished) {
      markFinished();
      if (settings.sound) sounds.success();
      if (settings.speech) speak('Last move done. Show the front face to verify.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.step]);

  useEffect(() => {
    const t = setTimeout(() => { cube.current?.frontView(); cube.current?.highlight(p.current); }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const move = p.current;
  const behind = move ? parseMove(move).face === 'B' : false;
  const cameraBroken = view === 'camera' && !['live', 'starting', 'idle', 'paused'].includes(cam.status);

  let trackText = '';
  if (view === '3d') trackText = '3D instruction view — not camera-tracked';
  else if (paused) trackText = 'Paused';
  else if (tracker.cvState === 'loading') trackText = 'Loading vision engine…';
  else if (tracker.cvState === 'failed') trackText = 'Tracking unavailable on this device — use 3D view';
  else if (track.kind === 'searching') trackText = 'Point the camera at the cube’s front face';
  else if (track.kind === 'wrong-face') trackText = `Turn the cube: ${track.want} center facing you, ${track.top} on top`;
  else if (track.kind === 'tracking') trackText = track.unique ? `Tracking · ${track.matches}/9 stickers match` : `Tracking · ${track.matches}/9 match (orientation assumed upright)`;
  else if (track.kind === 'done-move') trackText = settings.autoAdvance ? 'Move detected ✓ confirming…' : 'Looks done ✓ — tap Done';
  else if (track.kind === 'mismatch') trackText = 'Front face doesn’t match the expected pattern';

  const tracking = view === 'camera' && track.kind === 'tracking' && !paused;

  return (
    <main className="fixed inset-0 bg-black text-white flex flex-col">
      <div ref={stageRef} className="absolute inset-0">
        {view === 'camera' ? (
          <>
            <video ref={videoRef} className="camera" playsInline muted autoPlay aria-label="Live camera" />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" data-testid="ar-canvas" />
            {cameraBroken && <CameraFallback status={cam.status} onRetry={cam.retry} onManual={() => setView('3d')} manualLabel="Use the 3D instruction view" />}
          </>
        ) : (
          <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 40%, #1b2350, #05070f 70%)' }}>
            <Cube3D ref={cube} stickers={before} interactive className="absolute inset-0" label="3D instruction view" />
          </div>
        )}
      </div>

      {/* top HUD */}
      <div className="relative z-10 safe-top px-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-icon !bg-black/40" onClick={back} aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div className="flex-1 glass rounded-2xl px-3 py-2 !bg-black/45">
            <div className="flex items-baseline gap-2" data-testid="ar-step">
              {finished ? (
                <span className="font-display font-bold text-lg">All {total} moves done</span>
              ) : (
                <>
                  <span className="text-xs opacity-80">Step {p.step + 1} of {total}</span>
                  <span className="move-chip text-2xl" style={{ color: '#9db5ff' }}>{move}</span>
                </>
              )}
            </div>
            <ProgressBar value={total ? p.step / total : 1} label="Solving progress" />
          </div>
          <button className="btn btn-ghost !min-h-[44px] !px-3 text-xs !bg-black/40" onClick={() => setView(view === 'camera' ? '3d' : 'camera')} data-testid="toggle-view">
            {view === 'camera' ? '3D view' : 'Camera'}
          </button>
          <button className="btn btn-ghost btn-icon !bg-black/40" onClick={() => setShowSettings((s) => !s)} aria-label="Guide settings">⚙</button>
        </div>

        {!finished && move && (
          <div className="glass rounded-2xl px-3 py-2.5 !bg-black/50">
            <div className="text-[15px] font-semibold">{describeMove(move)}</div>
            <div className="text-[13px] opacity-85 mt-0.5">{frontViewHint(move)}</div>
            {behind && <div className="text-[12px] text-violet-200 mt-1">The back layer is hidden behind the cube — the dashed arrow shows its direction as seen from the front. Grip the back layer and turn it; keep the front facing you.</div>}
          </div>
        )}

        <div className="flex">
          <span className={`chip ${tracking ? 'bg-emerald-500/80' : view === '3d' ? 'bg-violet-600/80' : 'bg-black/55'}`} aria-live="polite" data-testid="track-status">
            {tracking && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />} {trackText}
          </span>
        </div>

        {view === 'camera' && track.kind === 'wrong-face' && !paused && (
          <div className="glass rounded-2xl px-3 py-2 !bg-black/55 text-sm flex items-center gap-2">
            Hold the <span className="inline-block w-4 h-4 rounded" style={{ background: COLOR_HEX[track.want] }} /> center toward the camera with <span className="inline-block w-4 h-4 rounded" style={{ background: COLOR_HEX[track.top] }} /> on top — the same way you scanned the first face.
          </div>
        )}
        {wrongMove && (
          <div className="glass-strong rounded-2xl p-3 text-sm text-[var(--text)]" role="alert">
            The front face hasn’t matched the expected pattern for a while. If a different move was made, rescan the cube to calculate a fresh solution from its current state.
            <div className="flex gap-2 mt-2">
              <button className="btn btn-primary !min-h-[40px] text-sm" onClick={() => { resetScan(); go('scan'); }}>Rescan & re-solve</button>
              <button className="btn btn-ghost !min-h-[40px] text-sm" onClick={() => setWrongMove(false)}>Dismiss</button>
            </div>
          </div>
        )}
        {showSettings && (
          <div className="glass-strong rounded-2xl p-3 text-[var(--text)] fade-in">
            <Toggle label="Auto-advance when the camera confirms the move" checked={settings.autoAdvance} onChange={(v) => update({ autoAdvance: v })} />
            <p className="text-[11px] text-[var(--muted)] -mt-1 mb-1">Only for moves that visibly change the front face; others always need a tap.</p>
            {speechSupported() && <Toggle label="Spoken instructions" checked={settings.speech} onChange={(v) => update({ speech: v })} />}
            <Toggle label="Sounds" checked={settings.sound} onChange={(v) => update({ sound: v })} />
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* bottom HUD */}
      <div className="relative z-10 px-3 safe-bottom flex flex-col gap-3">
        {view === 'camera' && (
          <div className="self-end w-28 h-28 rounded-2xl overflow-hidden glass !bg-black/45" title="Move preview">
            <Cube3D ref={cube} stickers={before} zoom={0.9} className="w-full h-full" label="Move preview" />
          </div>
        )}
        {finished ? (
          <div className="glass-strong rounded-2xl p-4 text-[var(--text)] text-center">
            <p className="text-sm mb-3">{frontVerified ? '✓ Front face verified solved by the camera.' : view === 'camera' ? 'Show the front face to the camera to verify, or finish.' : 'Your cube should now be solved.'}</p>
            <button className="btn btn-primary w-full h-14" onClick={() => go('success')} data-testid="finish">Finish</button>
          </div>
        ) : (
          <div className="grid grid-cols-[auto_auto_auto_auto_1fr] gap-2">
            <button className="btn btn-ghost btn-icon !bg-black/45" onClick={p.restart} aria-label="Restart solution">⏮</button>
            <button className="btn btn-ghost btn-icon !bg-black/45" onClick={p.prev} disabled={p.step === 0} aria-label="Previous move">◀</button>
            <button className="btn btn-ghost btn-icon !bg-black/45" onClick={p.repeat} aria-label="Repeat animation">↻</button>
            <button className="btn btn-ghost btn-icon !bg-black/45" onClick={() => setPaused((x) => !x)} aria-label={paused ? 'Resume' : 'Pause'} data-testid="pause">{paused ? '▶' : '❚❚'}</button>
            <button className="btn btn-primary h-12" onClick={p.next} aria-label="Done, next move" data-testid="next">Done · Next</button>
          </div>
        )}
      </div>
    </main>
  );
}
