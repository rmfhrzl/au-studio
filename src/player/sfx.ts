/**
 * Tiny WebAudio synthesiser for UI sounds.
 *
 * No audio files are shipped: every sound is generated, which keeps the app
 * fully offline and the bundle small. Sounds only play after a user gesture,
 * as required by browser autoplay policies.
 */

let ctx: AudioContext | null = null;
let enabled = true;

export function setSfxEnabled(value: boolean): void {
  enabled = value;
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, duration: number, volume = 0.05, type: OscillatorType = 'sine') {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ac.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(volume, ac.currentTime + start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + duration + 0.02);
}

export function sfxKey(): void {
  if (!enabled) return;
  tone(1180, 0, 0.035, 0.02, 'square');
}

export function sfxSend(): void {
  if (!enabled) return;
  tone(760, 0, 0.09, 0.045, 'sine');
  tone(1140, 0.06, 0.11, 0.04, 'sine');
}

export function sfxMessage(): void {
  if (!enabled) return;
  tone(880, 0, 0.08, 0.035, 'sine');
  tone(1320, 0.05, 0.1, 0.03, 'sine');
}

export function sfxUnlock(): void {
  if (!enabled) return;
  tone(660, 0, 0.12, 0.04, 'sine');
  tone(990, 0.09, 0.18, 0.035, 'sine');
}

export function sfxRing(): void {
  if (!enabled) return;
  const notes = [784, 988, 1319, 988, 784, 988, 1319, 1568];
  notes.forEach((n, i) => tone(n, i * 0.22, 0.2, 0.05, 'triangle'));
}

export function sfxError(): void {
  if (!enabled) return;
  tone(220, 0, 0.16, 0.05, 'sawtooth');
  tone(160, 0.12, 0.22, 0.05, 'sawtooth');
}

export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}
