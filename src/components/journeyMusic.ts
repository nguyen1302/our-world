// Gentle generative background music for the journey replay — no audio file
// needed (works offline). A soft music-box arpeggio over a calm chord loop.

type Audio = {
  ctx: AudioContext;
  master: GainNode;
  delay: DelayNode;
  timer: ReturnType<typeof setInterval> | null;
  beat: number;
};

let audio: Audio | null = null;
let muted = false;
let running = false;
let trackUrl: string | null = null;
let trackEl: HTMLAudioElement | null = null;

/** Set the uploaded song to use (null -> fall back to the generated tune). */
export function setMusicTrack(url: string | null) {
  trackUrl = url;
}

// C – G – Am – F, four notes per bar (a warm, nostalgic loop).
const PROG: number[][] = [
  [60, 64, 67, 72],
  [55, 59, 62, 67],
  [57, 60, 64, 69],
  [53, 57, 60, 65],
];

function midi(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}

function note(a: Audio, freq: number, dur: number, gain: number) {
  const t = a.ctx.currentTime;
  const osc = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(a.master);
  g.connect(a.delay);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function tick() {
  if (!audio) return;
  const a = audio;
  const bar = Math.floor(a.beat / 4) % PROG.length;
  const chord = PROG[bar];
  const step = a.beat % 4;
  // arpeggio up, with a sparkle an octave higher on the first beat
  note(a, midi(chord[step]), 1.1, 0.16);
  if (step === 0) note(a, midi(chord[0] + 12), 1.6, 0.10);
  if (step === 2) note(a, midi(chord[2] + 12), 1.2, 0.08);
  a.beat += 1;
}

export function startMusic() {
  if (running) return; // already playing — don't restart (avoids stutter when panels toggle)
  running = true;
  // Prefer the user's uploaded song; fall back to the generated tune.
  if (trackUrl) {
    try {
      if (!trackEl) trackEl = new Audio();
      if (trackEl.src !== trackUrl) trackEl.src = trackUrl;
      trackEl.loop = true;
      trackEl.volume = 0.7;
      trackEl.muted = muted;
      trackEl.play().catch(() => {});
      return;
    } catch {
      /* fall through to generated tune */
    }
  }
  try {
    if (!audio) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.22;
      master.connect(ctx.destination);
      const delay = ctx.createDelay();
      delay.delayTime.value = 0.33;
      const fb = ctx.createGain();
      fb.gain.value = 0.28;
      delay.connect(fb);
      fb.connect(delay);
      const wet = ctx.createGain();
      wet.gain.value = 0.5;
      delay.connect(wet);
      wet.connect(master);
      audio = { ctx, master, delay, timer: null, beat: 0 };
    }
    audio.ctx.resume();
    if (audio.timer) clearInterval(audio.timer);
    audio.beat = 0;
    tick();
    audio.timer = setInterval(tick, 480);
  } catch {
    /* WebAudio unavailable — silently skip */
  }
}

export function stopMusic() {
  running = false;
  if (trackEl) {
    try {
      trackEl.pause();
    } catch {}
  }
  if (!audio) return;
  if (audio.timer) clearInterval(audio.timer);
  audio.timer = null;
  try {
    audio.master.gain.linearRampToValueAtTime(0, audio.ctx.currentTime + 0.4);
  } catch {}
}

export function setMusicMuted(m: boolean) {
  muted = m;
  if (trackEl) trackEl.muted = m;
  if (audio) {
    try {
      audio.master.gain.value = m ? 0 : 0.22;
    } catch {}
  }
}

export function isMusicMuted() {
  return muted;
}
