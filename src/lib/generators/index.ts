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
export function generateQuestion(skill: Skill, level: number, seed: number): Question {
  const fn = generators[skill.generator];
  if (!fn) throw new Error(`Unknown generator: ${skill.generator}`);
  // Fold the skill id into the seed so two skills sharing a generator at the
  // same level don't serve identical questions.
  const rng = new Rng(seed ^ hashString(skill.id) ^ (level * 0x9e3779b9));
  const q: GeneratedQuestion = fn(rng, level, skill.params ?? {});
  return { ...q, skillId: skill.id, level, seed };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
