/**
 * Deterministic PRNG. Every question in the app is a pure function of
 * (generator, level, seed), so the server can re-derive the exact question --
 * and its answer -- when grading, without storing anything.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // mix the seed so nearby seeds don't produce correlated streams
    let h = seed >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    this.state = (h ^ (h >>> 16)) >>> 0 || 0x9e3779b9;
  }

  /** float in [0, 1) */
  next(): number {
    // xorshift32
    let x = this.state;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5;
    x >>>= 0;
    this.state = x;
    return x / 0x100000000;
  }

  /** integer in [min, max] inclusive */
  int(min: number, max: number): number {
    if (max < min) [min, max] = [max, min];
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  /** n distinct items (or as many as exist) */
  sample<T>(items: readonly T[], n: number): T[] {
    return this.shuffle([...items]).slice(0, n);
  }

  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  bool(p = 0.5): boolean {
    return this.next() < p;
  }

  /** integer in [min, max] excluding the given values */
  intExcept(min: number, max: number, except: number[]): number {
    for (let i = 0; i < 40; i++) {
      const v = this.int(min, max);
      if (!except.includes(v)) return v;
    }
    return min;
  }
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
