// Small WebAudio synth — no audio assets.
let ctx: AudioContext | null = null;
let muted = false;
try {
  muted = localStorage.getItem('wd.mute') === '1';
} catch {
  /* storage blocked */
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem('wd.mute', value ? '1' : '0');
  } catch {
    /* storage blocked */
  }
}

/** Call from a user gesture so the context may start. */
export function unlockAudio(): void {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0, slide = 0): void {
  if (muted || !ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, gain: number, delay = 0, freq = 800): void {
  if (muted || !ctx) return;
  const t = ctx.currentTime + delay;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start(t);
}

export const sfx = {
  click: () => tone(660, 0.05, 'triangle', 0.08),
  pick: () => tone(880, 0.07, 'triangle', 0.08),
  unpick: () => tone(520, 0.07, 'triangle', 0.06),
  hit: () => {
    noise(0.12, 0.35, 0, 300 + Math.random() * 500);
    tone(110 + Math.random() * 40, 0.12, 'square', 0.05, 0, -60);
  },
  spell: () => tone(700 + Math.random() * 300, 0.25, 'sine', 0.06, 0, 400),
  bossDie: () => {
    tone(180, 0.7, 'sawtooth', 0.08, 0, -140);
    noise(0.5, 0.3, 0.05, 200);
  },
  loot: () => [523, 659, 784].forEach((f, i) => tone(f, 0.25, 'triangle', 0.09, i * 0.07)),
  win: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.35, 'triangle', 0.1, i * 0.09)),
  epic: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.6, 'sine', 0.1, i * 0.12)),
  lose: () => [330, 262].forEach((f, i) => tone(f, 0.3, 'sine', 0.07, i * 0.16)),
  coin: () => tone(1800 + Math.random() * 600, 0.06, 'square', 0.03),
  levelUp: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.45, 'triangle', 0.1, i * 0.08)),
};
