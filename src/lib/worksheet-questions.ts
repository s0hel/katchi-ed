import { generateQuestion } from "./generators";
import { itemSeed, type PlannedItem, type WorksheetPlan } from "./worksheet";
import type { Question } from "./types";

/**
 * Turning a worksheet plan into actual questions.
 *
 * Deliberately separate from worksheet.ts, which plans the sheet: that module
 * is reachable from the client (the builder form needs `specToQuery`), and
 * this one imports the generators, which carry the answers.
 */

export interface FilledItem extends PlannedItem {
  question: Question;
}

/**
 * Generate a sheet's questions, skipping repeats.
 *
 * Computed skills effectively never collide, but a skill that draws from a
 * content bank picks an item rather than inventing one -- so a sheet asking
 * four sentence-completion questions can land on the same sentence twice,
 * which on paper reads as a mistake rather than as chance. A repeat is
 * re-derived from a further seed in the same worksheet seed space, so the
 * sheet stays a pure function of its URL and that space stays disjoint from
 * the practice endpoints'.
 *
 * Bounded: a bank smaller than the number of questions asked of it genuinely
 * cannot fill the sheet, and printing a repeat beats looping.
 */
export function fillWorksheet(plan: WorksheetPlan): FilledItem[] {
  const seen = new Set<string>();
  return plan.items.map((item, index) => {
    let seed = item.seed;
    let question = generateQuestion(item.skill, item.level, seed);
    for (let attempt = 1; attempt <= RETRIES && seen.has(identity(question)); attempt++) {
      seed = itemSeed(plan.spec.seed, index + attempt * RETRY_STRIDE);
      question = generateQuestion(item.skill, item.level, seed);
    }
    seen.add(identity(question));
    return { ...item, seed, question };
  });
}

const RETRIES = 8;
/** Comfortably past the largest sheet, so a retry cannot take another item's seed. */
const RETRY_STRIDE = 1000;

/**
 * What makes two questions the same question to the learner looking at them.
 *
 * The prompt only: the same sentence with its distractors reshuffled is the
 * same question twice, however different the options look. The prompt figure
 * is part of it because a picture item asks the same sentence every time
 * ("which picture belongs here?") and varies entirely in what it draws.
 */
export function identity(q: Question): string {
  return `${q.stem}::${q.figure ?? ""}`;
}
