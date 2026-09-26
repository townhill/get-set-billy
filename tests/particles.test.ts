import { describe, expect, it } from 'vitest';
import { ParticleField, type Particle, seededRandom } from '../src/render/particles';

const all = (field: ParticleField): Particle[] => {
  const out: Particle[] = [];
  field.forEach((speck) => out.push({ ...speck }));
  return out;
};

describe('the random numbers behind the specks', () => {
  it('repeat exactly for the same seed', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });

  it('stay between zero and one', () => {
    const random = seededRandom(7);
    for (let i = 0; i < 1000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('a burst', () => {
  const burst = (field: ParticleField): void =>
    field.burst({
      x: 100,
      y: 50,
      count: 12,
      colours: ['Y', 'C'],
      speed: [20, 40],
      gravity: 100,
      lifeMs: [300, 500],
    });

  it('makes as many specks as asked, in the colours asked', () => {
    const field = new ParticleField(seededRandom(1));
    burst(field);
    expect(field.count).toBe(12);
    for (const speck of all(field)) expect(['Y', 'C']).toContain(speck.colour);
  });

  it('comes out the same way every time for the same seed', () => {
    const a = new ParticleField(seededRandom(9));
    const b = new ParticleField(seededRandom(9));
    burst(a);
    burst(b);
    expect(all(a)).toEqual(all(b));
  });

  it('flies outward, falls, and is gone once its time is up', () => {
    const field = new ParticleField(seededRandom(3));
    field.burst({
      x: 0,
      y: 0,
      count: 1,
      colours: ['W'],
      speed: [100, 100],
      angle: [0, 0],
      gravity: 200,
      lifeMs: [500, 500],
    });
    field.step(100);
    const [speck] = all(field);
    expect(speck.x).toBeCloseTo(10);
    expect(speck.y).toBeGreaterThan(0);
    field.step(400);
    expect(field.count).toBe(0);
  });

  it('never grows past its limit, however much is thrown at it', () => {
    const field = new ParticleField(seededRandom(5), 30);
    for (let i = 0; i < 10; i++) burst(field);
    expect(field.count).toBe(30);
  });

  it('can be cleared all at once, for a room change', () => {
    const field = new ParticleField(seededRandom(5));
    burst(field);
    field.clear();
    expect(field.count).toBe(0);
  });
});

describe('specks drawing in', () => {
  it('start on a ring and all arrive at the middle together', () => {
    const field = new ParticleField(seededRandom(11));
    field.converge({ x: 40, y: 60, count: 8, radius: 16, colours: ['M'], durationMs: 200 });
    for (const speck of all(field)) {
      expect(Math.hypot(speck.x - 40, speck.y - 60)).toBeCloseTo(16);
    }
    field.step(199);
    for (const speck of all(field)) {
      expect(Math.hypot(speck.x - 40, speck.y - 60)).toBeLessThan(0.5);
    }
  });
});
