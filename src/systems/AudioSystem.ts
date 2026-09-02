import { AUDIO } from '../config';
import { SaveSystem } from './SaveSystem';

/**
 * Every sound in the game is a square wave generated on the spot, in the spirit
 * of a machine with one bit of audio and a great deal of optimism.
 *
 * Nothing is loaded, so nothing can fail to load. If the browser has no
 * AudioContext, or refuses to start one, the game carries on in silence.
 */

type Waveform = 'square' | 'triangle' | 'sawtooth';

interface Note {
  /** Hertz. A second value bends the pitch across the note. */
  freq: number;
  to?: number;
  /** Seconds. */
  duration: number;
  /** Seconds to wait before playing, relative to the start of the effect. */
  at?: number;
  gain?: number;
  wave?: Waveform;
}

const EFFECTS = {
  jump: [{ freq: 220, to: 560, duration: 0.13, gain: 0.7 }],
  land: [{ freq: 150, to: 90, duration: 0.05, gain: 0.35 }],
  collect: [
    { freq: 700, duration: 0.05 },
    { freq: 950, duration: 0.05, at: 0.05 },
    { freq: 1300, duration: 0.09, at: 0.1 },
  ],
  death: [
    { freq: 500, to: 60, duration: 0.55, wave: 'sawtooth' as Waveform, gain: 0.8 },
    { freq: 240, to: 40, duration: 0.55, at: 0.05, gain: 0.5 },
  ],
  roomChange: [{ freq: 420, to: 620, duration: 0.07, gain: 0.45 }],
  crumble: [{ freq: 180, to: 70, duration: 0.14, wave: 'sawtooth' as Waveform, gain: 0.5 }],
  locked: [
    { freq: 150, duration: 0.1, wave: 'sawtooth' as Waveform },
    { freq: 110, duration: 0.16, at: 0.12, wave: 'sawtooth' as Waveform },
  ],
  // A gate giving way: the clunk of the lock, then the bars going up.
  unlock: [
    { freq: 180, to: 120, duration: 0.09, wave: 'sawtooth' as Waveform, gain: 0.6 },
    { freq: 440, duration: 0.07, at: 0.1 },
    { freq: 660, duration: 0.07, at: 0.17 },
    { freq: 880, duration: 0.07, at: 0.24 },
    { freq: 1320, duration: 0.22, at: 0.31, gain: 0.55 },
  ],
  victory: [
    { freq: 523, duration: 0.12 },
    { freq: 659, duration: 0.12, at: 0.12 },
    { freq: 784, duration: 0.12, at: 0.24 },
    { freq: 1047, duration: 0.34, at: 0.36 },
    { freq: 784, duration: 0.34, at: 0.36, gain: 0.4 },
  ],
  gameOver: [
    { freq: 392, duration: 0.18 },
    { freq: 330, duration: 0.18, at: 0.18 },
    { freq: 262, duration: 0.18, at: 0.36 },
    { freq: 196, duration: 0.5, at: 0.54 },
  ],
  select: [{ freq: 880, duration: 0.05, gain: 0.4 }],
  // Going in one cupboard and out of another, somewhere else entirely.
  teleport: [
    { freq: 900, to: 200, duration: 0.12, gain: 0.5 },
    { freq: 300, to: 1200, duration: 0.16, at: 0.1, gain: 0.5 },
  ],
  // A lever being thrown: a heavy clunk, then whatever it moved settling.
  lever: [
    { freq: 260, to: 150, duration: 0.08, wave: 'square' as Waveform, gain: 0.7 },
    { freq: 420, duration: 0.06, at: 0.09, gain: 0.45 },
  ],
} satisfies Record<string, Note[]>;

export type SoundName = keyof typeof EFFECTS;

/** Middle A, which every theme's sting is measured in semitones from. */
const STING_ROOT = 440;

/** A short, cheerful, slightly wrong little tune for the title screen. */
const TITLE_TUNE: Note[] = [
  { freq: 392, duration: 0.16 },
  { freq: 523, duration: 0.16, at: 0.18 },
  { freq: 659, duration: 0.16, at: 0.36 },
  { freq: 587, duration: 0.16, at: 0.54 },
  { freq: 523, duration: 0.16, at: 0.72 },
  { freq: 440, duration: 0.32, at: 0.9 },
  { freq: 494, duration: 0.16, at: 1.26 },
  { freq: 392, duration: 0.42, at: 1.44 },
];

class AudioSystem {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private available = true;
  private mutedFlag: boolean = AUDIO.startMuted;

  /** Reads the player's saved preference. Safe to call before any sound plays. */
  init(): void {
    this.mutedFlag = SaveSystem.loadSettings().muted || AUDIO.startMuted;
  }

  get muted(): boolean {
    return this.mutedFlag;
  }

  setMuted(muted: boolean): void {
    this.mutedFlag = muted;
    if (this.master && this.context) {
      this.master.gain.setValueAtTime(muted ? 0 : AUDIO.volume, this.context.currentTime);
    }
    SaveSystem.saveSettings({ muted });
  }

  toggleMute(): boolean {
    this.setMuted(!this.mutedFlag);
    return this.mutedFlag;
  }

  /**
   * Browsers will not start audio until the player has touched something, so
   * this is called from the first key press rather than at boot.
   */
  unlock(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  private ensureContext(): AudioContext | null {
    if (!this.available) return null;
    if (this.context) return this.context;
    try {
      const Ctor =
        globalThis.AudioContext ??
        (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) throw new Error('no AudioContext');
      this.context = new Ctor();
      this.master = this.context.createGain();
      this.master.gain.value = this.mutedFlag ? 0 : AUDIO.volume;
      this.master.connect(this.context.destination);
      return this.context;
    } catch {
      this.available = false;
      return null;
    }
  }

  private playNotes(notes: readonly Note[]): void {
    if (this.mutedFlag) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const start = ctx.currentTime;
    for (const note of notes) {
      try {
        const at = start + (note.at ?? 0);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = note.wave ?? 'square';
        osc.frequency.setValueAtTime(note.freq, at);
        if (note.to !== undefined) {
          osc.frequency.linearRampToValueAtTime(note.to, at + note.duration);
        }
        const peak = note.gain ?? 0.6;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.linearRampToValueAtTime(peak, at + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + note.duration);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(at);
        osc.stop(at + note.duration + 0.02);
      } catch {
        // A single failed note is never worth interrupting the game for.
        return;
      }
    }
  }

  play(name: SoundName): void {
    this.playNotes(EFFECTS[name]);
  }

  /**
   * The three notes a room plays as you walk into it.
   *
   * Quiet and quick on purpose: it has to say "somewhere else now" without
   * getting in the way of the next thing you do, which is usually jumping.
   */
  playSting(semitones: readonly [number, number, number]): void {
    this.playNotes(
      semitones.map((step, index) => ({
        freq: STING_ROOT * Math.pow(2, step / 12),
        duration: 0.09,
        at: index * 0.055,
        gain: 0.3,
      })),
    );
  }

  playTitleTune(): void {
    this.playNotes(TITLE_TUNE);
  }
}

export const audio = new AudioSystem();
