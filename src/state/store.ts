import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ColorName, Face, StickerArray } from '../cube/types';
import type { CapturedFace, ScanCaptures } from '../scan/session';

export type Screen = 'home' | 'scan' | 'verify' | 'solution' | 'ar' | 'success' | 'help';
export type Source = 'scan' | 'manual' | 'demo';

export interface Solution {
  moves: string[];
  facelets: string;
  ms: number;
}

export interface Settings {
  theme: 'dark' | 'light';
  sound: boolean;
  speech: boolean;
  autoAdvance: boolean;
}

interface AppState {
  screen: Screen;
  backStack: Screen[];
  stickers: StickerArray;
  source: Source | null;
  captures: ScanCaptures;
  lowConfidence: number[];
  /** When set, the scan screen captures only this face and returns to verification. */
  rescanFace: Face | null;
  solution: Solution | null;
  step: number;
  startedAt: number | null;
  finishedAt: number | null;
  settings: Settings;

  go(screen: Screen): void;
  back(): void;
  setStickers(s: StickerArray, source?: Source, lowConfidence?: number[]): void;
  setSticker(i: number, c: ColorName | null): void;
  setCapture(f: Face, c: CapturedFace): void;
  resetScan(): void;
  setRescanFace(f: Face | null): void;
  setSolution(s: Solution | null): void;
  setStep(n: number): void;
  markStarted(): void;
  markFinished(): void;
  updateSettings(p: Partial<Settings>): void;
  resetAll(): void;
}

const empty = (): StickerArray => Array(54).fill(null);

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      screen: 'home',
      backStack: [],
      stickers: empty(),
      source: null,
      captures: {},
      lowConfidence: [],
      rescanFace: null,
      solution: null,
      step: 0,
      startedAt: null,
      finishedAt: null,
      settings: { theme: 'dark', sound: true, speech: false, autoAdvance: false },

      go: (screen) => set((s) => (s.screen === screen ? s : { screen, backStack: [...s.backStack.slice(-10), s.screen] })),
      back: () =>
        set((s) => {
          const stack = [...s.backStack];
          const prev = stack.pop() ?? 'home';
          return { screen: prev, backStack: stack };
        }),
      setStickers: (stickers, source, lowConfidence = []) =>
        set((s) => ({ stickers: stickers.slice(), source: source ?? s.source, lowConfidence, solution: null, step: 0 })),
      setSticker: (i, c) =>
        set((s) => {
          const stickers = s.stickers.slice();
          stickers[i] = c;
          return { stickers, lowConfidence: s.lowConfidence.filter((k) => k !== i), solution: null, step: 0 };
        }),
      setCapture: (f, c) => set((s) => ({ captures: { ...s.captures, [f]: c } })),
      resetScan: () => set({ captures: {}, rescanFace: null, lowConfidence: [] }),
      setRescanFace: (f) => set({ rescanFace: f }),
      setSolution: (solution) => set({ solution, step: 0, startedAt: null, finishedAt: null }),
      setStep: (n) => set((s) => ({ step: Math.max(0, Math.min(s.solution?.moves.length ?? 0, n)) })),
      markStarted: () => set((s) => (s.startedAt ? s : { startedAt: Date.now() })),
      markFinished: () => set({ finishedAt: Date.now() }),
      updateSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
      resetAll: () =>
        set({
          screen: 'home',
          backStack: [],
          stickers: empty(),
          source: null,
          captures: {},
          lowConfidence: [],
          rescanFace: null,
          solution: null,
          step: 0,
          startedAt: null,
          finishedAt: null,
          settings: get().settings,
        }),
    }),
    {
      name: 'cubear-session-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        // Camera screens are not restored after a reload (permissions must be re-requested).
        screen: s.screen === 'scan' || s.screen === 'ar' ? (s.solution ? 'solution' : 'home') : s.screen,
        stickers: s.stickers,
        source: s.source,
        captures: s.captures,
        lowConfidence: s.lowConfidence,
        solution: s.solution,
        step: s.step,
        startedAt: s.startedAt,
        settings: s.settings,
      }),
    },
  ),
);
