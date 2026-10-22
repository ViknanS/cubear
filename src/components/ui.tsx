import type { ReactNode } from 'react';
import { useApp } from '../state/store';

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f7cff" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <path d="M32 6 56 19v26L32 58 8 45V19z" fill="none" stroke="url(#lg)" strokeWidth="5" strokeLinejoin="round" />
      <path d="M8 19 32 32 56 19M32 32v26" fill="none" stroke="url(#lg)" strokeWidth="5" strokeLinejoin="round" />
    </svg>
  );
}

export function Header({ title, right, onBack }: { title?: string; right?: ReactNode; onBack?: () => void }) {
  const back = useApp((s) => s.back);
  const go = useApp((s) => s.go);
  const theme = useApp((s) => s.settings.theme);
  const update = useApp((s) => s.updateSettings);
  return (
    <header className="safe-top px-4 pb-2 flex items-center gap-2 sticky top-0 z-20 glass-strong !border-x-0 !border-t-0 mb-3">
      <button className="btn btn-ghost btn-icon" onClick={onBack ?? back} aria-label="Back">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Logo size={22} />
        <h1 className="font-display text-lg font-semibold truncate">{title}</h1>
      </div>
      {right}
      <button className="btn btn-ghost btn-icon" onClick={() => update({ theme: theme === 'dark' ? 'light' : 'dark' })} aria-label="Toggle light/dark appearance">
        {theme === 'dark' ? '☀︎' : '☾'}
      </button>
      <button className="btn btn-ghost btn-icon" onClick={() => go('help')} aria-label="Help">?</button>
    </header>
  );
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`glass rounded-3xl p-4 ${className}`}>{children}</section>;
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  return (
    <div className="w-full" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value * 100}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent2))' }} />
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer text-sm">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className="relative w-11 h-6 rounded-full transition-colors"
        style={{ background: checked ? 'var(--accent)' : 'rgba(150,160,200,.3)' }}
      >
        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: checked ? 22 : 2 }} />
      </button>
    </label>
  );
}
