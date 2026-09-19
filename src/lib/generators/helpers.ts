import type { Rng } from "../rng";
import type { GeneratedQuestion } from "../types";

export type Params = Record<string, number | string | boolean | undefined>;
export type GeneratorFn = (rng: Rng, level: number, params: Params) => GeneratedQuestion;

export function num(params: Params, key: string, fallback: number): number {
  const v = params[key];
  return typeof v === "number" ? v : fallback;
}

export function str(params: Params, key: string, fallback: string): string {
  const v = params[key];
  return typeof v === "string" ? v : fallback;
}

/** Build a multiple-choice question, shuffling distractors around the answer. */
export function choice(
  rng: Rng,
  q: Omit<GeneratedQuestion, "format" | "answer"> & { answer: string; distractors: string[] },
): GeneratedQuestion {
  const { distractors, answer, ...rest } = q;
  const unique = Array.from(new Set(distractors.filter((d) => d !== answer)));
  const choices = rng.shuffle([answer, ...unique.slice(0, 3)]);
  return { ...rest, answer, format: { kind: "choice", choices } };
}

export function numeric(q: Omit<GeneratedQuestion, "format">): GeneratedQuestion {
  return { ...q, format: { kind: "numeric" } };
}

export function text(q: Omit<GeneratedQuestion, "format"> & { placeholder?: string }): GeneratedQuestion {
  const { placeholder, ...rest } = q;
  return { ...rest, format: { kind: "text", placeholder } };
}

/**
 * Operand range for a difficulty level.
 *
 * Widening a range without raising its floor lets a top-level question come
 * out easier than a bottom-level one (level 4 was serving 2^3 while level 1
 * served 4^3). This lifts the floor along with the ceiling, so each tier
 * actually leaves the previous one behind.
 */
export function band(level: number, base: number, growth: number, lowFloor = 2): [number, number] {
  const max = base + (level - 1) * growth;
  if (level <= 1) return [lowFloor, max];
  const min = Math.max(lowFloor, Math.round(max * (0.15 + 0.1 * level)));
  return [Math.min(min, max - 1), max];
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

export interface Frac {
  n: number;
  d: number;
}

export function simplify({ n, d }: Frac): Frac {
  const g = gcd(n, d);
  const sign = d < 0 ? -1 : 1;
  return { n: (sign * n) / g, d: (sign * d) / g };
}

export function fracStr({ n, d }: Frac): string {
  const s = simplify({ n, d });
  return s.d === 1 ? `${s.n}` : `${s.n}/${s.d}`;
}

/** All the ways we'll accept a fraction typed by a learner. */
export function fracAccept(f: Frac): string[] {
  const s = simplify(f);
  const out = new Set<string>([`${s.n}/${s.d}`, `${f.n}/${f.d}`]);
  if (s.d === 1) out.add(`${s.n}`);
  // mixed number form, e.g. 7/4 -> "1 3/4"
  if (Math.abs(s.n) > s.d && s.d !== 1) {
    const whole = Math.trunc(s.n / s.d);
    const rem = Math.abs(s.n % s.d);
    if (rem) out.add(`${whole} ${rem}/${s.d}`);
  }
  return [...out];
}

/** Round to at most `places` decimals and drop trailing zeros. */
export function round(value: number, places = 2): string {
  const r = Number(value.toFixed(places));
  return `${r}`;
}

export function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Nearby wrong answers, useful as distractors for numeric-as-choice items. */
export function nearMisses(rng: Rng, answer: number, spread = 5, count = 3): string[] {
  const out = new Set<string>();
  let guard = 0;
  while (out.size < count && guard++ < 40) {
    const delta = rng.intExcept(-spread, spread, [0]);
    const v = answer + delta;
    if (v !== answer) out.add(`${v}`);
  }
  return [...out];
}

export const NAMES = [
  "Ava", "Noah", "Mia", "Liam", "Zoe", "Ethan", "Priya", "Omar", "Luca", "Nia",
  "Kai", "Sofia", "Diego", "Amara", "Jonas", "Yuki", "Hana", "Malik", "Elena", "Theo",
] as const;

export const OBJECTS = [
  ["apple", "apples"], ["marble", "marbles"], ["sticker", "stickers"], ["book", "books"],
  ["pencil", "pencils"], ["shell", "shells"], ["coin", "coins"], ["card", "cards"],
  ["balloon", "balloons"], ["cookie", "cookies"],
] as const;

export function plural(rng: Rng): readonly [string, string] {
  return rng.pick(OBJECTS);
}
