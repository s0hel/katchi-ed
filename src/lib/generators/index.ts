import { Rng } from "../rng";
import type { GeneratedQuestion, Question, Skill } from "../types";
import { mathGenerators } from "./math";
import { elaGenerators } from "./ela";
import type { GeneratorFn } from "./helpers";

export const generators: Record<string, GeneratorFn> = {
  ...mathGenerators,
  ...elaGenerators,
};

export function hasGenerator(name: string): boolean {
  return name in generators;
}

/**
 * Build a question. Pure: the same (skill, level, seed) always yields the same
 * question and the same answer, which is what lets the grading endpoint
 * re-derive the answer instead of trusting the client.
 */
/**
 * Generators write the minus operator as U+2212 ("4 − 11") while interpolated
 * negative numbers arrive with JavaScript's ASCII hyphen ("-7"), so the same
 * sentence could show both. This aligns them for display only: grading
 * normalizes U+2212 back to a hyphen, so comparisons are unaffected.
 */
function prettyMinus(text: string): string {
  // Also matches after a bold marker ("**-6x") and at the start of any line.
  return text.replace(/(^|[\s(=+\-×÷/,:−*])-(\d)/gm, "$1−$2");
}

const DISPLAY_FIELDS = ["stem", "instructions", "explanation", "hint"] as const;

export function generateQuestion(skill: Skill, level: number, seed: number): Question {
  const fn = generators[skill.generator];
  if (!fn) throw new Error(`Unknown generator: ${skill.generator}`);
  // Fold the skill id into the seed so two skills sharing a generator at the
  // same level don't serve identical questions.
  const rng = new Rng(seed ^ hashString(skill.id) ^ (level * 0x9e3779b9));
  const q: GeneratedQuestion = fn(rng, level, skill.params ?? {});

  const display = { ...q };
  for (const field of DISPLAY_FIELDS) {
    const value = display[field];
    if (typeof value === "string") display[field] = prettyMinus(value);
  }
  // Choices and the answer are kept in step with each other so the answer
  // still matches one of the options exactly.
  if (display.format.kind === "choice") {
    display.format = { ...display.format, choices: display.format.choices.map(prettyMinus) };
    display.answer = prettyMinus(display.answer);
    if (display.accept) display.accept = display.accept.map(prettyMinus);
  }

  return { ...display, skillId: skill.id, level, seed };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
