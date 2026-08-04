/**
 * Pomodoro completion chimes.
 *
 * Every sound here is synthesised with the Web Audio API rather than
 * shipped as an audio file. Three reasons: the extension carries no
 * binary audio payload, there is nothing to license (a bundled clip of
 * real film audio would be a copyright problem in a published
 * extension), and timbre/volume stay tunable from settings without
 * re-encoding anything.
 *
 * The palette leans on struck-idiophone timbres — music box, bell,
 * kalimba, wind chime — over pentatonic intervals, which is the
 * register the films' scores live in. Names match the characters
 * already used for the widget's break GIFs so the picker reads as one
 * set.
 */

export type PomodoroSoundKey =
  | "none"
  | "musicbox"
  | "sootsprite"
  | "catbus"
  | "windchime"
  | "kodama";

/** Order here is the order shown in the settings dropdown. */
export const POMODORO_SOUND_KEYS: readonly PomodoroSoundKey[] = [
  "musicbox",
  "sootsprite",
  "catbus",
  "windchime",
  "kodama",
  "none",
] as const;

export const isPomodoroSoundKey = (v: unknown): v is PomodoroSoundKey =>
  typeof v === "string" &&
  (POMODORO_SOUND_KEYS as readonly string[]).includes(v);

/** A single overtone of a struck note. */
interface Partial {
  /** Frequency as a multiple of the note's fundamental. Non-integer
   *  ratios are what make a bell read as metal rather than as an
   *  organ — real bells are inharmonic. */
  ratio: number;
  /** Peak gain relative to the voice's own gain. */
  gain: number;
  /** Seconds to decay to (near) silence. */
  decay: number;
}

interface Timbre {
  wave: OscillatorType;
  partials: Partial[];
}

const TIMBRES: Record<string, Timbre> = {
  // Long, glassy, clearly inharmonic — a struck bell.
  bell: {
    wave: "sine",
    partials: [
      { ratio: 1, gain: 1, decay: 2.6 },
      { ratio: 2.76, gain: 0.3, decay: 1.5 },
      { ratio: 5.4, gain: 0.12, decay: 0.8 },
    ],
  },
  // Shorter and sweeter, with an odd-harmonic tine edge.
  musicbox: {
    wave: "triangle",
    partials: [
      { ratio: 1, gain: 1, decay: 1.7 },
      { ratio: 3.01, gain: 0.22, decay: 0.75 },
      { ratio: 6.1, gain: 0.07, decay: 0.35 },
    ],
  },
  // Warm and round with almost no overtone — a thumb piano.
  kalimba: {
    wave: "sine",
    partials: [
      { ratio: 1, gain: 1, decay: 1.1 },
      { ratio: 2.0, gain: 0.14, decay: 0.4 },
    ],
  },
  // Blunt and quick — struck wood, barely any ring.
  wood: {
    wave: "sine",
    partials: [
      { ratio: 1, gain: 1, decay: 0.42 },
      { ratio: 2.1, gain: 0.35, decay: 0.2 },
    ],
  },
};

interface Note {
  /** Semitones from A4 (440 Hz). Negative = below. */
  semitone: number;
  /** Seconds after the chime starts. */
  at: number;
  /** Per-note gain, before the user's volume setting. */
  gain?: number;
}

interface Preset {
  timbre: keyof typeof TIMBRES;
  notes: Note[];
}

// Pentatonic figures — no semitone clashes, so they stay consonant
// however they overlap as the tails ring into each other.
const PRESETS: Record<Exclude<PomodoroSoundKey, "none">, Preset> = {
  // Rising major triad, unhurried. The default.
  musicbox: {
    timbre: "musicbox",
    notes: [
      { semitone: 15, at: 0 }, // C6
      { semitone: 19, at: 0.15 }, // E6
      { semitone: 22, at: 0.3, gain: 0.9 }, // G6
    ],
  },
  // Quick, light, slightly mischievous — high and clipped.
  sootsprite: {
    timbre: "wood",
    notes: [
      { semitone: 22, at: 0, gain: 0.8 },
      { semitone: 24, at: 0.09, gain: 0.7 },
      { semitone: 19, at: 0.18, gain: 0.6 },
      { semitone: 26, at: 0.3, gain: 0.5 },
    ],
  },
  // Low, warm and rounded — the softest of the set.
  catbus: {
    timbre: "kalimba",
    notes: [
      { semitone: 3, at: 0 }, // C5
      { semitone: 10, at: 0.13 }, // G5
      { semitone: 15, at: 0.26, gain: 0.85 }, // C6
    ],
  },
  // Sparse and shimmering, with the tails left to overlap.
  windchime: {
    timbre: "bell",
    notes: [
      { semitone: 19, at: 0, gain: 0.55 },
      { semitone: 26, at: 0.12, gain: 0.45 },
      { semitone: 22, at: 0.29, gain: 0.5 },
      { semitone: 31, at: 0.46, gain: 0.35 },
      { semitone: 24, at: 0.7, gain: 0.3 },
    ],
  },
  // Two hollow knocks, then a tone — the tree-spirit head-rattle.
  kodama: {
    timbre: "wood",
    notes: [
      { semitone: 10, at: 0, gain: 0.7 },
      { semitone: 10, at: 0.14, gain: 0.55 },
      { semitone: 17, at: 0.32, gain: 0.8 },
    ],
  },
};

/** Longest possible tail across all presets, used to size the
 *  auto-close timer on the shared context. */
const MAX_CHIME_SECONDS = 4;

const semitoneToHz = (semitone: number) => 440 * Math.pow(2, semitone / 12);

// One lazily-created context for the page. Created on first use rather
// than at module load: constructing an AudioContext before any user
// gesture starts it in "suspended" state and, in some Chrome versions,
// logs an autoplay warning on every new tab.
let ctx: AudioContext | null = null;

const getCtx = (): AudioContext | null => {
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null; // No Web Audio — chimes degrade to silence.
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
};

/**
 * Open (or re-open) the audio context while a user gesture is on the
 * stack.
 *
 * Chrome will not let a page start audio without user activation. A
 * pomodoro fires 25 minutes after the click that started it, long past
 * the transient-activation window, so we create and unsuspend the
 * context *during* the click instead. Once running, it stays running
 * and the later chime plays. Cheap and idempotent — safe to call on
 * every start/preview.
 */
export const primePomodoroAudio = (): void => {
  const c = getCtx();
  if (c && c.state === "suspended") void c.resume();
};

/** Schedule one struck note onto the context. */
const scheduleNote = (
  c: AudioContext,
  master: GainNode,
  timbre: Timbre,
  note: Note,
  startAt: number
) => {
  const fundamental = semitoneToHz(note.semitone);
  const noteGain = note.gain ?? 1;

  timbre.partials.forEach((partial) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = timbre.wave;
    osc.frequency.value = fundamental * partial.ratio;

    // Percussive envelope: a very short attack (a hard 0→peak jump
    // clicks) followed by an exponential decay. exponentialRampToValue
    // cannot target 0, hence the small floor before the hard stop.
    const peak = noteGain * partial.gain;
    const t0 = startAt;
    const t1 = t0 + 0.006;
    const end = t1 + partial.decay;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t1);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(end + 0.02);
  });
};

/**
 * Play a chime.
 *
 * @param sound   Which preset. "none" (or an unknown key) is silent.
 * @param volume  0–100, from widget settings.
 */
export const playPomodoroChime = (
  sound: PomodoroSoundKey,
  volume: number
): void => {
  if (sound === "none") return;
  const preset = PRESETS[sound as Exclude<PomodoroSoundKey, "none">];
  if (!preset) return;

  // Clamp defensively — settings come from localStorage and may have
  // been hand-edited or carried over from an older shape.
  const vol = Math.min(100, Math.max(0, Number(volume)));
  if (!Number.isFinite(vol) || vol === 0) return;

  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();

  const master = c.createGain();
  // Square-law taper: linear gain reads as very loud across the top of
  // the slider, so square it for a more even-feeling sweep. The 0.28
  // ceiling keeps a full-volume chime gentle — this is a focus timer,
  // not an alarm clock.
  const scaled = (vol / 100) ** 2 * 0.28;
  master.gain.value = scaled;
  master.connect(c.destination);

  const start = c.currentTime + 0.02;
  const timbre = TIMBRES[preset.timbre];
  preset.notes.forEach((note) =>
    scheduleNote(c, master, timbre, note, start + note.at)
  );

  // Drop the master node once the tail has rung out, so a long session
  // doesn't accumulate one detached GainNode per completed pomodoro.
  window.setTimeout(
    () => master.disconnect(),
    (MAX_CHIME_SECONDS + 0.5) * 1000
  );
};
