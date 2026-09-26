import type { PaletteKey } from '../assets/palette';

/**
 * Specks of dust, sparks and debris: the small stuff that makes a landing feel
 * like a landing and a pickup feel like a pickup.
 *
 * Presentation only. Nothing here can touch the player or be touched, and none
 * of it is read by the rules — which is why it may use a random number
 * generator at all, when everything that matters in the house runs on a clock.
 * The generator is seeded anyway, so a test can say exactly what a burst does.
 *
 * Imports no Phaser. The scene draws whatever is here as one-pixel rectangles.
 */

export interface Particle {
  x: number;
  y: number;
  /** Pixels per second. */
  vx: number;
  vy: number;
  /** Pixels per second squared, downward. */
  gravity: number;
  /** Milliseconds left to live. */
  lifeMs: number;
  colour: PaletteKey;
  /** Width and height, in pixels. */
  size: number;
}

/** A small, fast, seedable generator, so a burst can be repeated exactly. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface BurstOptions {
  x: number;
  y: number;
  count: number;
  colours: readonly PaletteKey[];
  /** Pixels per second, picked between the two. */
  speed: readonly [number, number];
  /** Radians, picked between the two. Zero is right; straight up is -PI/2. */
  angle?: readonly [number, number];
  gravity?: number;
  lifeMs: readonly [number, number];
  /** How far from (x, y) each speck may start, in pixels. */
  scatter?: number;
  size?: number;
}

export class ParticleField {
  private readonly specks: Particle[] = [];

  constructor(
    private readonly random: () => number = seededRandom(1),
    /** A hard ceiling, so a room full of bubbling liquid cannot grow without end. */
    readonly limit = 600,
  ) {}

  get count(): number {
    return this.specks.length;
  }

  add(particle: Particle): void {
    if (this.specks.length >= this.limit) this.specks.shift();
    this.specks.push(particle);
  }

  private between([low, high]: readonly [number, number]): number {
    return low + (high - low) * this.random();
  }

  /** A pick from a list, using the field's own generator. */
  pick<T>(options: readonly T[]): T {
    return options[Math.min(options.length - 1, Math.floor(this.random() * options.length))];
  }

  /** A number from 0 to 1, for callers deciding whether to make any specks at all. */
  chance(): number {
    return this.random();
  }

  burst(options: BurstOptions): void {
    const angle = options.angle ?? [0, Math.PI * 2];
    const scatter = options.scatter ?? 0;
    for (let i = 0; i < options.count; i++) {
      const heading = this.between(angle);
      const speed = this.between(options.speed);
      this.add({
        x: options.x + (this.random() * 2 - 1) * scatter,
        y: options.y + (this.random() * 2 - 1) * scatter,
        vx: Math.cos(heading) * speed,
        vy: Math.sin(heading) * speed,
        gravity: options.gravity ?? 0,
        lifeMs: this.between(options.lifeMs),
        colour: this.pick(options.colours),
        size: options.size ?? 1,
      });
    }
  }

  /**
   * Specks that start on a ring and fly into its middle, arriving together.
   *
   * The reverse of a burst: something arriving rather than something leaving.
   */
  converge(options: {
    x: number;
    y: number;
    count: number;
    radius: number;
    colours: readonly PaletteKey[];
    durationMs: number;
  }): void {
    const seconds = options.durationMs / 1000;
    for (let i = 0; i < options.count; i++) {
      const heading = (i / options.count) * Math.PI * 2 + this.random() * 0.3;
      const fromX = options.x + Math.cos(heading) * options.radius;
      const fromY = options.y + Math.sin(heading) * options.radius;
      this.add({
        x: fromX,
        y: fromY,
        vx: (options.x - fromX) / seconds,
        vy: (options.y - fromY) / seconds,
        gravity: 0,
        lifeMs: options.durationMs,
        colour: this.pick(options.colours),
        size: 1,
      });
    }
  }

  step(deltaMs: number): void {
    const dt = deltaMs / 1000;
    let kept = 0;
    for (const speck of this.specks) {
      speck.lifeMs -= deltaMs;
      if (speck.lifeMs <= 0) continue;
      speck.vy += speck.gravity * dt;
      speck.x += speck.vx * dt;
      speck.y += speck.vy * dt;
      this.specks[kept++] = speck;
    }
    this.specks.length = kept;
  }

  forEach(fn: (particle: Readonly<Particle>) => void): void {
    for (const speck of this.specks) fn(speck);
  }

  clear(): void {
    this.specks.length = 0;
  }
}
