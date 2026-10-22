import { useEffect, useMemo } from 'react';
import { Cube3D } from '../components/Cube3D';
import { Logo, Panel } from '../components/ui';
import { schemeStickers, type Face, type ColorName } from '../cube/types';
import { centerScheme } from '../cube/convert';
import { useApp } from '../state/store';

const CONFETTI = ['#4f7cff', '#8b5cf6', '#3ddc97', '#ffd500', '#ff7a00', '#e0201b', '#f4f6fb'];

export function SuccessScreen() {
  const stickers = useApp((s) => s.stickers);
  const solution = useApp((s) => s.solution);
  const startedAt = useApp((s) => s.startedAt);
  const finishedAt = useApp((s) => s.finishedAt);
  const resetAll = useApp((s) => s.resetAll);
  const go = useApp((s) => s.go);

  const solved = useMemo(() => {
    try {
      return schemeStickers(centerScheme(stickers) as Record<Face, ColorName>);
    } catch {
      return schemeStickers();
    }
  }, [stickers]);

  const pieces = useMemo(
    () => Array.from({ length: 70 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 1.2, dur: 2.4 + Math.random() * 2, color: CONFETTI[i % CONFETTI.length], rot: Math.random() * 360 })),
    [],
  );
  useEffect(() => { navigator.vibrate?.([30, 60, 30]); }, []);

  const secs = startedAt && finishedAt ? Math.max(1, Math.round((finishedAt - startedAt) / 1000)) : null;
  const time = secs ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : '—';

  return (
    <main className="flex-1 flex flex-col safe-top safe-bottom px-5 fade-in" data-testid="success">
      {pieces.map((p, i) => (
        <span key={i} className="confetti" style={{ left: `${p.left}%`, background: p.color, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`, transform: `rotate(${p.rot}deg)` }} />
      ))}
      <div className="flex items-center gap-2 pt-1"><Logo size={26} /><span className="font-display font-bold">CubeAR</span></div>
      <div className="relative h-[42vh] min-h-[240px]">
        <Cube3D stickers={solved} autoRotate className="absolute inset-0" label="Solved cube" />
      </div>
      <h1 className="font-display text-3xl font-bold text-center">Solved! 🎉</h1>
      <p className="text-center text-[var(--muted)] mt-1 mb-5">Every face is one color again.</p>
      <div className="grid grid-cols-2 gap-3 max-w-md w-full mx-auto">
        <Panel className="text-center"><div className="text-3xl font-display font-bold">{solution?.moves.length ?? 0}</div><div className="text-xs text-[var(--muted)]">moves</div></Panel>
        <Panel className="text-center"><div className="text-3xl font-display font-bold">{time}</div><div className="text-xs text-[var(--muted)]">guided solve time</div></Panel>
      </div>
      <div className="max-w-md w-full mx-auto flex flex-col gap-3 mt-6">
        <button className="btn btn-primary h-14" onClick={() => { resetAll(); go('scan'); }}>Scan another cube</button>
        <button className="btn btn-ghost" onClick={resetAll}>Back to home</button>
      </div>
    </main>
  );
}
