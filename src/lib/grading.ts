import type { Question } from "./types";
import { gcd } from "./generators/helpers";

/**
 * Learners type answers in many equivalent ways ("1,200", "1200", "$3.50",
 * "3.5", "2/4", "1/2"). Normalization decides what counts as the same answer.
 */
export function normalize(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[−–—]/g, "-") // unicode minus/dashes -> hyphen
    .replace(/[×]/g, "x")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ");
}

/** Strip formatting that never changes a numeric value. */
function numericish(s: string): string {
  return normalize(s).replace(/[$,\s]/g, "").replace(/%$/, "");
}

function asNumber(s: string): number | null {
  const cleaned = numericish(s);
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Parse "3/4", "-3/4", "1 3/4", or a plain number into a reduced fraction. */
function asFraction(s: string): { n: number; d: number } | null {
  const cleaned = numericish(s);
  const mixed = cleaned.match(/^(-?\d+)[_\-\s]+(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const n = Number(mixed[2]);
    const d = Number(mixed[3]);
    if (!d) return null;
    const sign = whole < 0 ? -1 : 1;
    return reduce({ n: whole * d + sign * n, d });
  }
  const frac = cleaned.match(/^(-?\d+)\/(-?\d+)$/);
  if (frac) {
    const d = Number(frac[2]);
    if (!d) return null;
    return reduce({ n: Number(frac[1]), d });
  }
  const dec = asNumber(cleaned);
  if (dec === null) return null;
  if (Number.isInteger(dec)) return { n: dec, d: 1 };
  // convert a terminating decimal to a fraction
  const places = (cleaned.split(".")[1] ?? "").length;
  return reduce({ n: Math.round(dec * 10 ** places), d: 10 ** places });
}

function reduce({ n, d }: { n: number; d: number }): { n: number; d: number } {
  const g = gcd(n, d) || 1;
  const sign = d < 0 ? -1 : 1;
  return { n: (sign * n) / g, d: (sign * d) / g };
}

/**
 * Text answers: ignore punctuation spacing and trailing periods, and -- unless
 * the question says otherwise -- case.
 *
 * `keepCase` exists for the capitalization skill. Lower-casing both sides there
 * compares the student's answer against the prompt with the one thing being
 * tested erased, so copying the miscapitalized sentence back unchanged scored
 * as correct on every question.
 */
function textish(s: string, keepCase = false): string {
  const base = keepCase
    ? s.trim().replace(/[\u2212\u2013\u2014]/g, "-").replace(/[\u2019\u2018]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, " ")
    : normalize(s);
  return base
    .replace(/\s*([,;:.!?])\s*/g, "$1")
    .replace(/[.]+$/, "")
    .replace(/\s+/g, " ");
}

export interface GradeResult {
  correct: boolean;
  /** Canonical answer, for display in feedback. */
  expected: string;
  explanation: string;
}

export function gradeAnswer(question: Question, response: string): GradeResult {
  const expected = question.answer;
  const candidates = [expected, ...(question.accept ?? [])];
  const correct = candidates.some((c) => matches(question, c, response));
  return { correct, expected, explanation: question.explanation };
}

function matches(question: Question, expected: string, response: string): boolean {
  if (!response.trim()) return false;

  switch (question.format.kind) {
    case "numeric": {
      const a = asNumber(expected);
      const b = asNumber(response);
      if (a === null || b === null) return numericish(expected) === numericish(response);
      // tolerance covers rounding differences on π-based and mean answers
      return Math.abs(a - b) < 1e-6 || Math.abs(a - b) <= 0.005;
    }
    case "fraction": {
      const a = asFraction(expected);
      const b = asFraction(response);
      if (!a || !b) return textish(expected) === textish(response);
      return a.n === b.n && a.d === b.d;
    }
    case "pair": {
      const split = (s: string) =>
        normalize(s)
          .replace(/[a-z]\s*=\s*/g, "")
          .split(/[,;\s]+/)
          .filter(Boolean);
      const a = split(expected);
      const b = split(response);
      return a.length === b.length && a.every((v, i) => {
        const av = asNumber(v);
        const bv = asNumber(b[i]);
        return av !== null && bv !== null ? Math.abs(av - bv) < 1e-6 : v === b[i];
      });
    }
    case "choice":
      return textish(expected) === textish(response);
    case "text": {
      const keepCase = question.format.caseSensitive === true;
      return textish(expected, keepCase) === textish(response, keepCase);
    }
    default:
      return textish(expected) === textish(response);
  }
}
