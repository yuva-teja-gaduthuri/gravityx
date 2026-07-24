// Sound effect synthesizer utilizing HTML5 Web Audio API.
// Automatically bypasses browser auto-play restrictions by lazily initializing AudioContext on user interaction.

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play dice roll clicking sound
 */
export function playDiceRoll() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // Create 6 quick clicking sounds to simulate a rolling die
  for (let i = 0; i < 6; i++) {
    const time = now + i * 0.08;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120 + Math.random() * 80, time);
    osc.frequency.exponentialRampToValueAtTime(10, time + 0.05);

    gain.gain.setValueAtTime(0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + 0.06);
  }
}

/**
 * Play piece movement jumping pop sound
 */
export function playTokenMove() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(350, now);
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.12);

  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.15);
}

/**
 * Play token capture blast sound
 */
export function playTokenCapture() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.linearRampToValueAtTime(50, now + 0.4);

  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.45);
}

/**
 * Play victory chiptune melody
 */
export function playVictory() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [
    { freq: 261.63, dur: 0.15 }, // C4
    { freq: 329.63, dur: 0.15 }, // E4
    { freq: 392.00, dur: 0.15 }, // G4
    { freq: 523.25, dur: 0.35 }  // C5
  ];

  let timeOffset = 0;
  notes.forEach((note) => {
    const time = now + timeOffset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(note.freq, time);

    gain.gain.setValueAtTime(0.08, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + note.dur - 0.02);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + note.dur);

    timeOffset += note.dur;
  });
}
