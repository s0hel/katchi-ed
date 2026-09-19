import { describe, expect, it } from "vitest";
import { getSkill } from "../curriculum";
import { generateQuestion } from "../generators";
import { gradeAnswer } from "../grading";
import { BANKS } from "../generators/banks";

/**
 * The capitalization skill is the one place where case IS the answer, so it
 * cannot use the case-insensitive comparison every other text question uses.
 * It did, and that made the skill score a student as correct for copying the
 * miscapitalized prompt straight back.
 */
describe("capitalization grading", () => {
  const skill = getSkill("ela-2-capitalization")!;
  const questions = Array.from({ length: 40 }, (_, i) => generateQuestion(skill, 4, i + 1));

  it("rejects the prompt copied back unchanged", () => {
    const wronglyAccepted = questions.filter((q) => gradeAnswer(q, q.stem).correct);
    expect(wronglyAccepted).toEqual([]);
  });

  it("accepts the correctly capitalized sentence", () => {
    const wronglyRejected = questions.filter((q) => !gradeAnswer(q, q.answer).correct);
    expect(wronglyRejected).toEqual([]);
  });

  it("still forgives a missing trailing period and stray spacing", () => {
    for (const q of questions.slice(0, 10)) {
      expect(gradeAnswer(q, q.answer.replace(/\.$/, "")).correct).toBe(true);
      expect(gradeAnswer(q, `  ${q.answer}  `).correct).toBe(true);
    }
  });

  it("accepts the documented style variants", () => {
    for (const item of BANKS.capitalization) {
      for (const variant of item.accept ?? []) {
        const q = questions.find((x) => x.answer === item.right);
        if (q) expect(gradeAnswer(q, variant).correct).toBe(true);
      }
    }
  });

  it("leaves other text questions case-insensitive", () => {
    const spelling = getSkill("ela-3-irregular-plurals");
    if (!spelling) return;
    const q = generateQuestion(spelling, 1, 7);
    if (q.format.kind === "text") {
      expect(gradeAnswer(q, q.answer.toUpperCase()).correct).toBe(true);
    }
  });
});
