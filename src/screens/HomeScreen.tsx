import { useMemo } from 'react';
import { Cube3D } from '../components/Cube3D';
import { Logo } from '../components/ui';
import { STANDARD_SCHEME, type StickerArray } from '../cube/types';
import { demoStickers } from '../state/demo';
import { useApp } from '../state/store';

export function HomeScreen() {
  const go = useApp((s) => s.go);
  const setStickers = useApp((s) => s.setStickers);
  const resetScan = useApp((s) => s.resetScan);
  const solution = useApp((s) => s.solution);
  const step = useApp((s) => s.step);
  const theme = useApp((s) => s.settings.theme);
  const update = useApp((s) => s.updateSettings);
  const hero = useMemo(() => demoStickers(), []);

  const manual = () => {
    // Blank cube with standard centers pre-filled; every center is still editable.
    const s: StickerArray = Array(54).fill(null);
    Object.values(STANDARD_SCHEME).forEach((c, f) => (s[9 * f + 4] = c));
    setStickers(s, 'manual');
    go('verify');
  };

  return (
    <main className="flex-1 flex flex-col safe-top safe-bottom px-5 fade-in">
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Logo size={30} />
          <span className="font-display text-xl font-bold tracking-tight">
            Cube<span style={{ color: 'var(--accent)' }}>AR</span>
          </span>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-icon" onClick={() => update({ theme: theme === 'dark' ? 'light' : 'dark' })} aria-label="Toggle light/dark appearance">
            {theme === 'dark' ? '☀︎' : '☾'}
          </button>
          <button className="btn btn-ghost btn-icon" onClick={() => go('help')} aria-label="Help">?</button>
        </div>
      </div>

      <div className="relative flex-1 min-h-[300px] max-h-[460px] my-2">
        <div className="absolute inset-[12%] rounded-full blur-3xl opacity-60" style={{ background: 'radial-gradient(circle, var(--accent2), transparent 70%)' }} />
        <Cube3D stickers={hero} autoRotate className="absolute inset-0" label="Animated 3D Rubik's cube" />
      </div>

      <div className="max-w-md w-full mx-auto">
        <h1 className="font-display text-[2rem] leading-tight font-bold">
          Point. Scan.{' '}
          <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(90deg, var(--accent), var(--accent2))' }}>
            Solve.
          </span>
        </h1>
        <p className="text-[var(--muted)] mt-2 mb-6 text-[0.95rem]">
          Scan all six faces with your camera, get a short (about 20-move) solution from Kociemba’s two-phase algorithm, and follow arrows drawn right on your cube.
        </p>

        <div className="flex flex-col gap-3">
          <button className="btn btn-primary w-full text-base h-14" onClick={() => { resetScan(); go('scan'); }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><rect x="7" y="7" width="10" height="10" rx="1.5" /></svg>
            Scan My Cube
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button className="btn btn-ghost" onClick={manual}>Manual Entry</button>
            <button className="btn btn-ghost" onClick={() => { setStickers(demoStickers(), 'demo'); go('verify'); }}>Try Demo</button>
          </div>
          {solution && (
            <button className="btn btn-ghost w-full" onClick={() => go('solution')}>
              Resume last solve · step {step} of {solution.moves.length}
            </button>
          )}
        </div>
        <p className="text-[11px] text-[var(--muted)] text-center mt-5">Runs entirely in your browser · no account · no uploads</p>
      </div>
    </main>
  );
}
