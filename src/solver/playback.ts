/** Pure state machine for stepping through a solution. `step` = number of moves already performed. */
export interface PlaybackState {
  moves: string[];
  step: number;
  paused: boolean;
}

export type PlaybackAction =
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'restart' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'goto'; step: number }
  | { type: 'load'; moves: string[] };

export function playbackReducer(s: PlaybackState, a: PlaybackAction): PlaybackState {
  switch (a.type) {
    case 'next':
      return s.step < s.moves.length ? { ...s, step: s.step + 1 } : s;
    case 'prev':
      return s.step > 0 ? { ...s, step: s.step - 1 } : s;
    case 'restart':
      return { ...s, step: 0, paused: false };
    case 'pause':
      return { ...s, paused: true };
    case 'resume':
      return { ...s, paused: false };
    case 'goto':
      return { ...s, step: Math.max(0, Math.min(s.moves.length, Math.round(a.step))) };
    case 'load':
      return { moves: a.moves, step: 0, paused: false };
  }
}

export const isComplete = (s: PlaybackState) => s.step >= s.moves.length;
export const currentMove = (s: PlaybackState): string | null => s.moves[s.step] ?? null;
export const progress = (s: PlaybackState) => (s.moves.length ? s.step / s.moves.length : 1);
