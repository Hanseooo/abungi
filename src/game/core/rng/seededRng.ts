export interface SerializedRng { seed: number; state: number }

const normalize = (value: number) => (value >>> 0) || 0x6d2b79f5;

export class SeededRng {
  readonly seed: number;
  private state: number;

  constructor(seed: number, state?: number) {
    this.seed = normalize(seed);
    this.state = normalize(state ?? seed);
  }

  next(): number {
    // Mulberry32: compact, deterministic, serializable and sufficient for game randomness.
    let t = (this.state += 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const out = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    this.state >>>= 0;
    return out;
  }

  int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) throw new Error('Invalid RNG integer range');
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  chance(probability: number): boolean {
    if (probability <= 0) return false;
    if (probability >= 1) return true;
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Cannot pick from an empty collection');
    return items[this.int(0, items.length - 1)];
  }

  weightedPick<T extends { weight: number }>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Cannot pick from an empty collection');
    const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
    if (total <= 0) return items[0];
    let roll = this.next() * total;
    for (const item of items) {
      roll -= Math.max(0, item.weight);
      if (roll <= 0) return item;
    }
    return items[items.length - 1];
  }

  serialize(): SerializedRng { return { seed: this.seed, state: this.state >>> 0 }; }
  static from(snapshot: SerializedRng): SeededRng { return new SeededRng(snapshot.seed, snapshot.state); }
}
