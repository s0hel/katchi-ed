import { gradeLabel, skillsFor, subjectName } from "./curriculum";
import { Rng } from "./rng";
import type { Skill, Subject } from "./types";

/**
 * Printable worksheets: a fixed set of questions for a grade, or for a chosen
 * handful of its skills, laid out for paper and optionally followed by an
 * answer key.
 *
 * A worksheet is a pure function of its spec, exactly like a practice question
 * is a pure function of (skill, level, seed). The spec lives entirely in the
 * URL, so a sheet is reproducible: the same link always prints the same
 * questions, and a teacher who wants a second form just changes the seed.
 *
 * This module deliberately does not import the generators. It is reachable
 * from the client (the builder form needs `specToQuery`), and the generators
 * carry the answers.
 */

/**
 * Worksheet item seeds start here; practice seeds (`newSeed`) stop below it,
 * and `questionRequest` in api-schema.ts caps `seed` at the same value. The
 * two seed spaces therefore never overlap, so no amount of fiddling with a
 * worksheet URL can print the answer to a question `/api/grade` is scoring
 * someone on. See the disjointness test in `__tests__/worksheet.test.ts`.
 */
export const WORKSHEET_SEED_BASE = 2 ** 31;

export const MIN_QUESTIONS = 4;
export const MAX_QUESTIONS = 40;
export const DEFAULT_QUESTIONS = 20;

/** "mixed" ramps each skill through its own tiers; a number pins every item. */
export type WorksheetLevel = "mixed" | number;

export interface WorksheetSpec {
  subject: Subject;
  grade: number;
  /** Empty means every skill in the grade. */
  skillIds: string[];
  count: number;
  level: WorksheetLevel;
  seed: number;
  columns: 1 | 2;
  /** Leave ruled space under each question for working out. */
  workSpace: boolean;
  /** Append the answer key. Off by default: the student copy is the default. */
  answerKey: boolean;
}

export interface PlannedItem {
  /** 1-based position on the sheet. */
  number: number;
  skill: Skill;
  level: number;
  seed: number;
}

export interface WorksheetPlan {
  spec: WorksheetSpec;
  title: string;
  subtitle: string;
  /** Distinct skills used, in sheet order. */
  skills: Skill[];
  items: PlannedItem[];
  /** Short human-readable code for the seed, printed on the sheet. */
  code: string;
}

/**
 * Derive an item's seed. Mixing through the PRNG (rather than using the index
 * directly) keeps consecutive items uncorrelated, and the offset holds every
 * result inside the worksheet seed space.
 */
export function itemSeed(worksheetSeed: number, index: number): number {
  const rng = new Rng((worksheetSeed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0);
  return WORKSHEET_SEED_BASE + rng.int(0, WORKSHEET_SEED_BASE - 1);
}

function poolFor(spec: WorksheetSpec): Skill[] {
  const all = skillsFor(spec.subject, spec.grade);
  if (!spec.skillIds.length) return all;
  const wanted = new Set(spec.skillIds);
  const picked = all.filter((s) => wanted.has(s.id));
  return picked.length ? picked : all;
}

/**
 * Pick a level for item `j` of `n` drawn from the same skill. The half-step
 * offset is what stops a skill that contributes a single question from always
 * drawing the easiest tier.
 */
function levelFor(spec: WorksheetSpec, j: number, n: number, maxLevel: number): number {
  if (spec.level !== "mixed") return Math.min(Math.max(1, spec.level), maxLevel);
  return Math.min(maxLevel, 1 + Math.floor(((j + 0.35) / n) * maxLevel));
}

export function planWorksheet(spec: WorksheetSpec): WorksheetPlan {
  const pool = poolFor(spec);
  const rng = new Rng(spec.seed);

  // Deal the slots round-robin over a shuffled pool: every skill gets an even
  // share, and which ones get the spare question varies with the seed.
  const shares = new Map<string, number>();
  const order = rng.shuffle([...pool]);
  for (let i = 0; i < spec.count; i++) {
    const s = order[i % order.length];
    shares.set(s.id, (shares.get(s.id) ?? 0) + 1);
  }

  // Print in catalog order, so a sheet reads like the skill list it came from
  // and a learner works through one skill at a time.
  const skills = pool.filter((s) => shares.has(s.id));
  const items: PlannedItem[] = [];
  for (const skill of skills) {
    const n = shares.get(skill.id) ?? 0;
    const maxLevel = skill.levels ?? 4;
    for (let j = 0; j < n; j++) {
      items.push({
        number: items.length + 1,
        skill,
        level: levelFor(spec, j, n, maxLevel),
        seed: itemSeed(spec.seed, items.length),
      });
    }
  }

  const levelLabel = spec.level === "mixed" ? "mixed levels" : `level ${spec.level}`;
  return {
    spec,
    title: `${gradeLabel(spec.grade)} ${subjectName(spec.subject).toLowerCase()}`,
    subtitle:
      skills.length === 1
        ? `${skills[0].code} · ${skills[0].name} · ${items.length} questions`
        : `${items.length} questions · ${skills.length} skills · ${levelLabel}`,
    skills,
    items,
    code: spec.seed.toString(36).toUpperCase(),
  };
}

/* ------------------------------------------------------------ url coding */

type Params = Record<string, string | string[] | undefined>;

/** The spec keys, in the order both `rawQuery` and `specToQuery` emit them. */
const KEYS = ["subject", "grade", "skills", "count", "level", "cols", "work", "key", "seed"] as const;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Everything but the seed. This is what the builder links with: the print
 * route mints a seed and redirects, so each visit from the builder is a new
 * sheet while the URL it lands on reprints that one.
 */
export function unseededQuery(spec: Omit<WorksheetSpec, "seed">): string {
  const q = new URLSearchParams();
  q.set("subject", spec.subject);
  q.set("grade", String(spec.grade));
  if (spec.skillIds.length) q.set("skills", spec.skillIds.join(","));
  q.set("count", String(spec.count));
  if (spec.level !== "mixed") q.set("level", String(spec.level));
  if (spec.columns === 2) q.set("cols", "2");
  if (spec.workSpace) q.set("work", "1");
  if (spec.answerKey) q.set("key", "1");
  return q.toString();
}

/** `seed` is emitted last, matching the key order `rawQuery` reads in. */
export function specToQuery(spec: WorksheetSpec): string {
  return `${unseededQuery(spec)}&seed=${spec.seed.toString(36)}`;
}

/**
 * The query string as it arrived, restricted to the keys a spec uses and
 * emitted in the same order as `specToQuery`. The print route compares the
 * two and redirects when they differ, so every printed sheet sits on a URL
 * that reproduces it exactly.
 */
export function rawQuery(params: Params): string {
  const q = new URLSearchParams();
  for (const key of KEYS) {
    const value = one(params[key]);
    if (value) q.set(key, value);
  }
  return q.toString();
}

/** Returns null only when the subject/grade pair isn't one we teach. */
export function parseSpec(params: Params): WorksheetSpec | null {
  const subject = one(params.subject);
  if (subject !== "math" && subject !== "ela") return null;

  const grade = Number(one(params.grade));
  const gradeSkills = Number.isInteger(grade) ? skillsFor(subject, grade) : [];
  if (!gradeSkills.length) return null;

  // Unknown ids are dropped rather than rejected: a stale link should still
  // print something sensible.
  const valid = new Set(gradeSkills.map((s) => s.id));
  const skillIds = (one(params.skills) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((id) => valid.has(id));

  const rawCount = Math.round(Number(one(params.count)));
  const count = Number.isFinite(rawCount) && rawCount > 0
    ? clamp(rawCount, MIN_QUESTIONS, MAX_QUESTIONS)
    : DEFAULT_QUESTIONS;

  const rawLevel = one(params.level);
  const level: WorksheetLevel = rawLevel && /^[1-8]$/.test(rawLevel) ? Number(rawLevel) : "mixed";

  const rawSeed = one(params.seed);
  const parsedSeed = rawSeed && /^[0-9a-z]{1,7}$/.test(rawSeed) ? parseInt(rawSeed, 36) : NaN;
  const seed = Number.isInteger(parsedSeed) && parsedSeed >= 0 && parsedSeed < WORKSHEET_SEED_BASE
    ? parsedSeed
    : Math.floor(Math.random() * WORKSHEET_SEED_BASE);

  return {
    subject,
    grade,
    skillIds: [...new Set(skillIds)],
    count,
    level,
    seed,
    columns: one(params.cols) === "2" ? 2 : 1,
    workSpace: one(params.work) === "1",
    answerKey: one(params.key) === "1",
  };
}

export function printHref(spec: WorksheetSpec): string {
  return `/worksheet/print?${specToQuery(spec)}`;
}

export function builderHref(spec: Pick<WorksheetSpec, "subject" | "grade"> & { skillIds?: string[] }): string {
  const q = new URLSearchParams({ subject: spec.subject, grade: String(spec.grade) });
  if (spec.skillIds?.length) q.set("skills", spec.skillIds.join(","));
  return `/worksheet?${q.toString()}`;
}
