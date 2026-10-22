let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, gain = 0.08) {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, a.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, a.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + start);
  o.stop(a.currentTime + start + dur + 0.02);
}

export const sounds = {
  capture: () => { tone(660, 0, 0.09); tone(990, 0.08, 0.12); },
  move: () => tone(880, 0, 0.1, 0.06),
  error: () => { tone(220, 0, 0.15); tone(180, 0.12, 0.2); },
  success: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.25)),
};

export function speak(text: string) {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/'/g, ' prime'));
    u.rate = 1;
    window.speechSynthesis.speak(u);
  } catch {
    /* speech is optional */
  }
}

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;
