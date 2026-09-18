/**
 * SmartScore: a 0-100 mastery meter, in the spirit of IXL's.
 *
 * The shape that matters pedagogically:
 *  - gains shrink as the score climbs, so the last stretch demands consistency
 *  - losses grow as the score climbs, so a lucky streak can't be coasted on
 *  - question difficulty rises with the score, so practice stays in the
 *    "challenge zone" instead of drilling what the learner already owns
 */

export const MASTERY = 100;
export const PROFICIENT = 80;
export const EXCELLING = 90;

export interface SkillState {
  score: number;
  /** consecutive correct answers */
  streak: number;
  asked: number;
  correct: number;
  /** total practice time in ms */
  timeMs: number;
  /** epoch ms of the last answered question */
  lastPracticed: number | null;
  /** highest score ever reached, so a bad day doesn't erase the record */
  best: number;
}

export function emptySkillState(): SkillState {
  return { score: 0, streak: 0, asked: 0, correct: 0, timeMs: 0, lastPracticed: null, best: 0 };
}

/** Difficulty tier (1..levels) to serve next at the current score. */
export function levelForScore(score: number, levels = 4): number {
  if (score <= 0) return 1;
  const tier = Math.floor((score / MASTERY) * levels) + 1;
  return Math.min(levels, Math.max(1, tier));
}

export interface ScoreChange {
  state: SkillState;
  delta: number;
  justMastered: boolean;
  justProficient: boolean;
}

/**
 * Award or deduct points for one answered question.
 *
 * Gains: ~10 at the start, ~2 near mastery. Reaching 100 from 0 takes roughly
 * 18-22 correct answers in a row -- close to IXL's feel.
 * Losses: ~4 at the bottom, up to ~17 at 99, so late mistakes genuinely cost.
 */
export function applyAnswer(prev: SkillState, correct: boolean, elapsedMs: number): ScoreChange {
  const before = prev.score;
  let delta: number;

  if (correct) {
    const remaining = MASTERY - before;
    const base = 2 + Math.round(remaining * 0.085);
    // a short streak bonus rewards consistency without trivializing the climb
    const streakBonus = prev.streak >= 4 ? 2 : prev.streak >= 2 ? 1 : 0;
    delta = Math.min(remaining, base + streakBonus);
  } else {
    delta = -Math.min(before, 4 + Math.round((before / MASTERY) * 13));
  }

  const score = clamp(before + delta, 0, MASTERY);
  const state: SkillState = {
    score,
    streak: correct ? prev.streak + 1 : 0,
    asked: prev.asked + 1,
    correct: prev.correct + (correct ? 1 : 0),
    timeMs: prev.timeMs + Math.max(0, Math.min(elapsedMs, 10 * 60_000)),
    lastPracticed: Date.now(),
    best: Math.max(prev.best, score),
  };

  return {
    state,
    delta: score - before,
    justMastered: before < MASTERY && score >= MASTERY,
    justProficient: before < PROFICIENT && score >= PROFICIENT,
  };
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export type ScoreBand = "none" | "developing" | "proficient" | "excelling" | "mastered";

export function scoreBand(score: number): ScoreBand {
  if (score >= MASTERY) return "mastered";
  if (score >= EXCELLING) return "excelling";
  if (score >= PROFICIENT) return "proficient";
  if (score > 0) return "developing";
  return "none";
}

export const BAND_LABEL: Record<ScoreBand, string> = {
  none: "Not started",
  developing: "Developing",
  proficient: "Proficient",
  excelling: "Excelling",
  mastered: "Mastered",
};

/** Tailwind classes per band, so the meter reads the same everywhere. */
export const BAND_CLASS: Record<ScoreBand, { bar: string; text: string; chip: string }> = {
  none: { bar: "bg-slate-300 dark:bg-slate-600", text: "text-slate-500 dark:text-slate-400", chip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  developing: { bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", chip: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  proficient: { bar: "bg-sky-500", text: "text-sky-700 dark:text-sky-400", chip: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  excelling: { bar: "bg-violet-500", text: "text-violet-700 dark:text-violet-400", chip: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300" },
  mastered: { bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
};

/** Encouragement shown after each answer -- tone shifts with the score. */
export function feedbackLine(correct: boolean, state: SkillState, delta: number): string {
  if (!correct) {
    return state.score === 0
      ? "Not quite. Read the explanation, then try the next one."
      : `Not quite — that's ${delta} points. Check the explanation below.`;
  }
  if (state.score >= MASTERY) return "Mastered! You've hit 100.";
  if (state.streak >= 5) return `${state.streak} in a row! +${delta}`;
  if (state.score >= EXCELLING) return `Excellent — +${delta}. Almost there.`;
  return `Correct! +${delta}`;
}
