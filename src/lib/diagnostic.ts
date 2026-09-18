import { SKILLS, gradeLabel } from "./curriculum";
import type { Skill, Subject } from "./types";
import { clamp } from "./smartscore";

/**
 * Adaptive diagnostic.
 *
 * Each strand carries an ability estimate on a 0-1000 scale where a grade's
 * "on level" score is (grade + 1) * 100 -- Kindergarten 100, 8th grade 900,
 * Algebra 1 1000. After each answer the estimate steps toward the learner's
 * true level, with the step size decaying so early answers move it a lot and
 * later answers fine-tune it (stochastic approximation, the practical cousin
 * of a full IRT model).
 */

export const SCALE_MIN = 50;
export const SCALE_MAX = 1000;

export function gradeToScore(grade: number): number {
  return (grade + 1) * 100;
}

export function scoreToGrade(score: number): number {
  return clamp(Math.round(score / 100) - 1, 0, 9);
}

export function scoreToGradeLabel(score: number): string {
  return gradeLabel(scoreToGrade(score));
}

export interface StrandEstimate {
  strand: string;
  score: number;
  asked: number;
  correct: number;
}

export interface DiagnosticState {
  subject: Subject;
  /** the grade the learner says they're in, used as the starting estimate */
  startGrade: number;
  strands: StrandEstimate[];
  asked: number;
  targetQuestions: number;
  /** skill ids already served, so the diagnostic doesn't repeat itself */
  seen: string[];
  finished: boolean;
}

export function startDiagnostic(subject: Subject, startGrade: number, targetQuestions = 20): DiagnosticState {
  const strands = [...new Set(SKILLS.filter((s) => s.subject === subject).map((s) => s.strand))];
  return {
    subject,
    startGrade,
    strands: strands.map((strand) => ({
      strand,
      score: gradeToScore(startGrade),
      asked: 0,
      correct: 0,
    })),
    asked: 0,
    targetQuestions,
    seen: [],
    finished: false,
  };
}

/** How far the estimate moves on the next answer. Decays with evidence. */
function stepSize(asked: number): number {
  return Math.max(18, 150 / (1 + asked * 0.75));
}

/** The strand that most needs evidence: fewest answers, ties broken by order. */
function nextStrand(state: DiagnosticState): StrandEstimate {
  return [...state.strands].sort((a, b) => a.asked - b.asked || a.strand.localeCompare(b.strand))[0];
}

export interface DiagnosticPick {
  skill: Skill;
  level: number;
  strand: string;
}

/** Choose the next skill: the one in the target strand closest to its estimate. */
export function pickNext(state: DiagnosticState): DiagnosticPick | null {
  if (state.finished || state.asked >= state.targetQuestions) return null;
  const target = nextStrand(state);
  const candidates = SKILLS.filter((s) => s.subject === state.subject && s.strand === target.strand);
  if (!candidates.length) return null;

  const unseen = candidates.filter((s) => !state.seen.includes(s.id));
  const pool = unseen.length ? unseen : candidates;

  let best = pool[0];
  let bestDistance = Infinity;
  for (const skill of pool) {
    const distance = Math.abs(gradeToScore(skill.grade) - target.score);
    if (distance < bestDistance) {
      best = skill;
      bestDistance = distance;
    }
  }

  // Where the estimate sits inside that grade decides the difficulty tier.
  const withinGrade = (target.score - gradeToScore(best.grade) + 50) / 100;
  const levels = best.levels ?? 4;
  const level = clamp(Math.round(withinGrade * levels) || 1, 1, levels);

  return { skill: best, level, strand: target.strand };
}

export function recordAnswer(state: DiagnosticState, pick: DiagnosticPick, correct: boolean): DiagnosticState {
  const strands = state.strands.map((s) => {
    if (s.strand !== pick.strand) return s;
    const step = stepSize(s.asked);
    // Missing an easy item costs more than missing a hard one, and nailing a
    // hard item is worth more than nailing an easy one.
    const itemScore = gradeToScore(pick.skill.grade);
    const surprise = clamp((itemScore - s.score) / 200, -0.6, 0.6);
    const move = correct ? step * (1 + surprise) : -step * (1 - surprise);
    return {
      ...s,
      score: clamp(s.score + move, SCALE_MIN, SCALE_MAX),
      asked: s.asked + 1,
      correct: s.correct + (correct ? 1 : 0),
    };
  });

  const asked = state.asked + 1;
  return {
    ...state,
    strands,
    asked,
    seen: [...state.seen, pick.skill.id],
    finished: asked >= state.targetQuestions,
  };
}

export interface DiagnosticReport {
  overall: number;
  overallGrade: number;
  strands: (StrandEstimate & { grade: number; label: string })[];
  strongest: string | null;
  growthArea: string | null;
  /** skills to practice next, weakest strand first */
  recommended: Skill[];
}

export function buildReport(state: DiagnosticState): DiagnosticReport {
  const answered = state.strands.filter((s) => s.asked > 0);
  const basis = answered.length ? answered : state.strands;
  const overall = basis.reduce((sum, s) => sum + s.score, 0) / basis.length;

  const strands = state.strands
    .map((s) => ({ ...s, grade: scoreToGrade(s.score), label: scoreToGradeLabel(s.score) }))
    .sort((a, b) => b.score - a.score);

  const ranked = [...answered].sort((a, b) => b.score - a.score);
  const strongest = ranked[0]?.strand ?? null;
  const growthArea = ranked.length > 1 ? ranked[ranked.length - 1].strand : null;

  const recommended: Skill[] = [];
  for (const s of [...answered].sort((a, b) => a.score - b.score)) {
    const grade = scoreToGrade(s.score);
    const matches = SKILLS.filter(
      (sk) => sk.subject === state.subject && sk.strand === s.strand && Math.abs(sk.grade - grade) <= 1,
    );
    recommended.push(...matches.slice(0, 2));
  }

  return {
    overall,
    overallGrade: scoreToGrade(overall),
    strands,
    strongest,
    growthArea,
    recommended: recommended.slice(0, 6),
  };
}
