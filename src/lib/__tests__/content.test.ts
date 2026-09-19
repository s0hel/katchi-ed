import { describe, expect, it } from "vitest";
import { SKILLS, getSkill } from "../curriculum";
import { generateQuestion, generators } from "../generators";
import { gradeAnswer } from "../grading";
import { Rng } from "../rng";

const SEEDS = [1, 7, 42, 1234, 99999, 2 ** 30];

describe("curriculum", () => {
  it("has skills", () => {
    expect(SKILLS.length).toBeGreaterThan(80);
  });

  it("gives every skill a unique id", () => {
    const ids = SKILLS.map((s) => s.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it("references only generators that exist", () => {
    const missing = SKILLS.filter((s) => !(s.generator in generators)).map((s) => `${s.id} -> ${s.generator}`);
    expect(missing).toEqual([]);
  });

  it("is resolvable by id", () => {
    for (const s of SKILLS) expect(getSkill(s.id)).toBeDefined();
  });
});

describe("question generation", () => {
  it("produces a well-formed question for every skill, level, and seed", () => {
    const problems: string[] = [];
    for (const skill of SKILLS) {
      for (let level = 1; level <= (skill.levels ?? 4); level++) {
        for (const seed of SEEDS) {
          let q;
          try {
            q = generateQuestion(skill, level, seed);
          } catch (err) {
            problems.push(`${skill.id} L${level} seed ${seed} threw: ${(err as Error).message}`);
            continue;
          }
          const where = `${skill.id} L${level} seed ${seed}`;
          if (!q.stem?.trim()) problems.push(`${where}: empty stem`);
          if (!q.answer?.trim()) problems.push(`${where}: empty answer`);
          if (!q.explanation?.trim()) problems.push(`${where}: empty explanation`);
          // Figures are checked alongside the text: a picture question shows
          // the learner an SVG, and "one small undefined circle" is as broken
          // there as it would be in a stem.
          const figures = [q.figure ?? "", ...(q.format.kind === "choice" ? (q.format.figures ?? []) : [])];
          const rendered = q.stem + q.answer + q.explanation + figures.join("");
          if (/NaN|undefined|Infinity/.test(rendered)) {
            problems.push(`${where}: bad value in question -> ${q.stem} | ${q.answer}`);
          }
          if (q.format.kind === "choice") {
            if (q.format.choices.length < 2) problems.push(`${where}: too few choices`);
            if (!q.format.choices.includes(q.answer)) problems.push(`${where}: answer missing from choices`);
            if (new Set(q.format.choices).size !== q.format.choices.length) {
              problems.push(`${where}: duplicate choices`);
            }
          }
        }
      }
    }
    expect(problems.slice(0, 20)).toEqual([]);
  });

  it("is deterministic for the same skill, level, and seed", () => {
    for (const skill of SKILLS.slice(0, 40)) {
      const a = generateQuestion(skill, 2, 777);
      const b = generateQuestion(skill, 2, 777);
      expect(a).toEqual(b);
    }
  });

  it("varies across seeds", () => {
    // Fingerprinted rather than compared on the stem alone: a nonverbal item
    // asks the same sentence every time ("which picture belongs here?") and
    // varies entirely in the figure and the options, so a stem-only check
    // would call a perfectly varied generator broken.
    const fingerprint = (skill: (typeof SKILLS)[number], seed: number) => {
      const q = generateQuestion(skill, 3, seed);
      const options = q.format.kind === "choice" ? q.format.choices.join("|") : "";
      const figures = q.format.kind === "choice" ? (q.format.figures ?? []).join("|") : "";
      return `${q.stem}::${q.figure ?? ""}::${options}::${figures}`;
    };
    for (const skill of SKILLS) {
      const seen = new Set(SEEDS.map((s) => fingerprint(skill, s)));
      // a few generators draw from small banks; require at least some variety
      expect(seen.size, `${skill.id} produced identical questions`).toBeGreaterThan(1);
    }
  });

  it("accepts its own canonical answer", () => {
    const failures: string[] = [];
    for (const skill of SKILLS) {
      for (let level = 1; level <= (skill.levels ?? 4); level++) {
        for (const seed of SEEDS.slice(0, 4)) {
          const q = generateQuestion(skill, level, seed);
          if (!gradeAnswer(q, q.answer).correct) {
            failures.push(`${skill.id} L${level} seed ${seed}: rejected "${q.answer}"`);
          }
          for (const alt of q.accept ?? []) {
            if (!gradeAnswer(q, alt).correct) {
              failures.push(`${skill.id} L${level} seed ${seed}: rejected accepted form "${alt}"`);
            }
          }
        }
      }
    }
    expect(failures.slice(0, 20)).toEqual([]);
  });

  it("rejects a clearly wrong answer", () => {
    const leaks: string[] = [];
    for (const skill of SKILLS) {
      const q = generateQuestion(skill, 2, 31337);
      const bogus = q.format.kind === "choice"
        ? q.format.choices.find((c) => c !== q.answer)!
        : "definitely-not-the-answer-42x";
      if (gradeAnswer(q, bogus).correct) leaks.push(`${skill.id} accepted "${bogus}" for "${q.answer}"`);
      if (gradeAnswer(q, "").correct) leaks.push(`${skill.id} accepted an empty answer`);
    }
    expect(leaks).toEqual([]);
  });
});

describe("grading normalization", () => {
  const skill = SKILLS.find((s) => s.generator === "multi-digit-add")!;

  it("accepts thousands separators", () => {
    const q = generateQuestion(skill, 3, 5);
    const plain = q.answer.replace(/,/g, "");
    expect(gradeAnswer(q, Number(plain).toLocaleString()).correct).toBe(true);
    expect(gradeAnswer(q, ` ${plain} `).correct).toBe(true);
  });

  it("treats equivalent fractions as equal", () => {
    const fracSkill = SKILLS.find((s) => s.generator === "fraction-add")!;
    const q = generateQuestion(fracSkill, 1, 11);
    expect(gradeAnswer(q, q.answer).correct).toBe(true);
    expect(gradeAnswer(q, `  ${q.answer}  `).correct).toBe(true);
  });
});

describe("rng", () => {
  it("stays within bounds", () => {
    const rng = new Rng(9);
    for (let i = 0; i < 5000; i++) {
      const v = rng.int(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
    }
  });

  it("produces different streams for different seeds", () => {
    const a = Array.from({ length: 10 }, (_, i) => new Rng(i).int(0, 1000));
    expect(new Set(a).size).toBeGreaterThan(5);
  });
});

describe("grade appropriateness", () => {
  const seeds = Array.from({ length: 60 }, (_, i) => i * 977 + 3);

  it("keeps the grade 5 coordinate skill in the first quadrant", () => {
    // 5.G.A.1-2 covers the first quadrant only; negative coordinates are grade 6.
    const skill = SKILLS.find((s) => s.id === "math-5-points-on-a-coordinate-grid")!;
    expect(skill).toBeDefined();
    const leaks: string[] = [];
    for (let level = 1; level <= (skill.levels ?? 4); level++) {
      for (const seed of seeds) {
        const q = generateQuestion(skill, level, seed);
        const text = `${q.stem} ${q.answer} ${q.figure ?? ""}`;
        if (/-\d/.test(text)) leaks.push(`L${level} seed ${seed}: ${q.stem.slice(0, 50)} -> ${q.answer}`);
      }
    }
    expect(leaks.slice(0, 5)).toEqual([]);
  });

  it("ramps difficulty instead of ignoring level", () => {
    // Several generators once took `level` and did nothing with it, so every
    // tier served the same question and the SmartScore ramp did nothing.
    const skill = SKILLS.find((s) => s.id === "math-6-quadrants-of-the-coordinate-plane")!;
    const shapes = new Set<string>();
    for (let level = 1; level <= 4; level++) {
      const q = generateQuestion(skill, level, 555);
      shapes.add(`${q.format.kind}:${q.instructions}:${q.figure ? "fig" : "nofig"}`);
    }
    expect(shapes.size).toBeGreaterThan(2);
  });

  it("shows a figure whenever a question refers to a plotted point", () => {
    const missing: string[] = [];
    for (const skill of SKILLS) {
      for (let level = 1; level <= (skill.levels ?? 4); level++) {
        for (const seed of seeds.slice(0, 12)) {
          const q = generateQuestion(skill, level, seed);
          // "point A" / "point P" phrasing only makes sense with a picture
          if (/\bpoint \*\*[A-Z]\*\*/.test(q.stem) && !q.figure) {
            missing.push(`${skill.id} L${level} seed ${seed}`);
          }
        }
      }
    }
    expect(missing.slice(0, 5)).toEqual([]);
  });
});

describe("question typography", () => {
  it("uses one minus glyph per question", () => {
    // Generators write the operator as U+2212 while interpolated negatives
    // arrive as an ASCII hyphen, which produced "4 − 11 = -7".
    const mixed: string[] = [];
    for (const skill of SKILLS) {
      for (let level = 1; level <= (skill.levels ?? 4); level++) {
        for (const seed of [5, 136, 267, 398, 529]) {
          const q = generateQuestion(skill, level, seed);
          for (const field of [q.stem, q.explanation, q.hint ?? ""]) {
            if (field.includes("−") && /-\d/.test(field)) {
              mixed.push(`${skill.id} L${level}: ${field.replace(/\n+/g, " ").slice(0, 60)}`);
            }
          }
        }
      }
    }
    expect(mixed.slice(0, 5)).toEqual([]);
  });

  it("keeps multiple-choice answers matching their options exactly", () => {
    // Display formatting rewrites choices, so the answer must be rewritten too.
    const broken: string[] = [];
    for (const skill of SKILLS) {
      for (let level = 1; level <= (skill.levels ?? 4); level++) {
        const q = generateQuestion(skill, level, 424242);
        if (q.format.kind === "choice" && !q.format.choices.includes(q.answer)) {
          broken.push(`${skill.id} L${level}: "${q.answer}" not among ${q.format.choices.join(" / ")}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });
});
