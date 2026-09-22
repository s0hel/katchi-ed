/**
 * Core subjects teach a grade band; test-prep subjects rehearse one exam at
 * one entry point, which is why they pin a single grade in the catalog.
 */
export type Subject = "math" | "ela" | "cogat" | "ngat" | "isee";

export type AnswerFormat =
  | { kind: "numeric" }
  /** `caseSensitive` is for questions where capitalization IS the answer. */
  | { kind: "text"; placeholder?: string; caseSensitive?: boolean }
  /**
   * `figures`, when present, is one inline SVG per choice, in the same order.
   * A nonverbal item is a picture question all the way down: the choices are
   * shapes and the strings are just the labels ("A", "B") used to answer.
   */
  | { kind: "choice"; choices: string[]; figures?: string[] }
  | { kind: "fraction" }
  | { kind: "pair"; labels: [string, string] };

/** What a generator returns. */
export interface GeneratedQuestion {
  /** Question text. Supports a tiny markup subset: **bold**, _italic_, `code`. */
  stem: string;
  /** Short directive shown above the stem, e.g. "Solve for x". */
  instructions?: string;
  format: AnswerFormat;
  /** Canonical answer, as the learner would type it. */
  answer: string;
  /** Additional accepted spellings/forms (normalized before comparison). */
  accept?: string[];
  /** Shown after an incorrect answer. */
  explanation: string;
  hint?: string;
  /** Optional inline SVG figure (geometry, number lines, charts). */
  figure?: string;
}

/** A question as stored/served, with identity attached. */
export interface Question extends GeneratedQuestion {
  skillId: string;
  level: number;
  seed: number;
}

/** What the browser is allowed to see. */
export type ClientQuestion = Omit<Question, "answer" | "accept" | "explanation">;

export interface Skill {
  id: string;
  /** IXL-style code within the grade, e.g. "B.4" */
  code: string;
  name: string;
  subject: Subject;
  /** 0 = Kindergarten, 1..8, 9 = Algebra 1 */
  grade: number;
  strand: string;
  generator: string;
  params?: Record<string, number | string | boolean>;
  /** number of difficulty tiers this skill ramps through (default 4) */
  levels?: number;
}

export interface GradeInfo {
  grade: number;
  label: string;
  short: string;
}
