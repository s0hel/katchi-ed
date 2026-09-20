import { describe, expect, it } from "vitest";
import { skillsFor } from "../curriculum";
import { generateQuestion } from "../generators";

/**
 * CogAT items always offer four.
 *
 * The real form does, and the lower tiers here used to offer three -- so a
 * six-year-old practised on a narrower board than the one they sit. Making
 * every generator ask for four is only half the fix: `figureChoice` hands back
 * however many distinct options it was actually given, so a generator whose
 * distractors collapse into each other quietly serves three anyway. That is
 * what this file watches for, and it takes a lot of seeds to see: a collapse
 * usually needs a particular rule to land on a particular number.
 */
const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7919 + 13);

describe("CogAT answer options", () => {
  for (const skill of skillsFor("cogat", 1)) {
    it(`offers four choices at every level: ${skill.id}`, () => {
      const short: string[] = [];
      for (let level = 1; level <= (skill.levels ?? 4); level++) {
        for (const seed of SEEDS) {
          const q = generateQuestion(skill, level, seed);
          expect(q.format.kind).toBe("choice");
          if (q.format.kind !== "choice") continue;
          if (q.format.choices.length !== 4) {
            short.push(`level ${level}, seed ${seed}: ${q.format.choices.length} choices`);
          }
        }
      }
      expect(short.slice(0, 5)).toEqual([]);
    });
  }
});
