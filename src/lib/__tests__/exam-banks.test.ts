import { describe, expect, it } from "vitest";
import { SKILLS, skillsFor } from "../curriculum";
import { generateQuestion } from "../generators";
import { COGAT_BANKS, EXAM_BANK_NAMES, ISEE_BANKS, examBankItems } from "../generators/exam-banks";
import { EXAM_ITEM_SCHEMA, examDedupeKey, reviewExamDraft } from "../generators/exam-bank-schema";
import { unfoldHoles } from "../generators/shapes";
import { hasIcon } from "../generators/pictures";

const SEEDS = [1, 7, 42, 1234, 99999, 2 ** 30];

/**
 * Guards the CogAT and ISEE banks, and the two properties of these subjects
 * that no generic content test can see: a picture item has to carry pictures
 * all the way into its options, and a quantitative-comparison item has to key
 * the verdict that its own numbers support.
 */
describe("exam content banks", () => {
  for (const bank of EXAM_BANK_NAMES) {
    describe(bank, () => {
      const items = examBankItems(bank);

      it("is non-empty", () => {
        expect(items.length).toBeGreaterThan(0);
      });

      it("has well-formed items", () => {
        const schema = EXAM_ITEM_SCHEMA[bank];
        const bad = items
          .map((item, i) => {
            const parsed = schema.safeParse(item);
            return parsed.success ? null : { i, issues: parsed.error.issues.map((e) => e.message) };
          })
          .filter(Boolean);
        expect(bad).toEqual([]);
      });

      it("has no duplicate items", () => {
        const key = examDedupeKey[bank] as (item: unknown) => string;
        const seen = new Map<string, number>();
        const dupes: string[] = [];
        items.forEach((item, i) => {
          const k = key(item);
          if (seen.has(k)) dupes.push(`${k} (items ${seen.get(k)} and ${i})`);
          else seen.set(k, i);
        });
        expect(dupes).toEqual([]);
      });

      it("is big enough for the level split to mean something", () => {
        // The bottom tier draws from the front 45% of a bank; below about ten
        // items that slice is the same handful of questions every time.
        expect(items.length).toBeGreaterThanOrEqual(6);
      });
    });
  }

  it("rejects a draft that repeats an item already in the bank", () => {
    const existing = COGAT_BANKS.pictureAnalogies[0];
    const review = reviewExamDraft("cogat.pictureAnalogies", [existing]);
    expect(review.kept).toEqual([]);
    expect(review.rejected[0].why).toBe("duplicate");
  });

  it("rejects a picture item written without pictures", () => {
    const review = reviewExamDraft("cogat.pictureGroups", [
      {
        group: ["dog", "cat", "horse"],
        answer: "cow",
        wrong: ["tree", "bicycle", "bread"],
        why: "They are all animals.",
      },
    ]);
    expect(review.kept).toEqual([]);
    expect(review.rejected[0].why).toContain("emoji");
  });

  it("keeps every sentence-completion option pointable", () => {
    // "Can you find it?" is answered by pointing, so an option has to be a
    // thing. A sentence whose answer is "greater" or "sick" cannot be asked
    // this way, however good the sentence is.
    for (const item of COGAT_BANKS.sentenceCompletion) {
      expect(item.s, item.s).toContain("___");
      for (const option of [item.answer, ...item.wrong]) {
        expect(hasIcon(option), `${item.s} -> ${option}`).toBe(true);
      }
    }
  });

  it("has drawable artwork for every picture in the banks", () => {
    // A bank item can name an emoji nobody vendored, and the renderer would
    // fall back to the text glyph -- small, and different on every device,
    // which is the whole problem the artwork solves. Run:
    //   npx vite-node scripts/build-icons.ts
    const pictures = [
      ...COGAT_BANKS.pictureAnalogies.flatMap((i) => [i.a, i.b, i.c, i.answer, ...i.wrong]),
      ...COGAT_BANKS.pictureGroups.flatMap((i) => [...i.group, i.answer, ...i.wrong]),
      ...COGAT_BANKS.sentenceCompletion.flatMap((i) => [i.answer, ...i.wrong]),
    ];
    expect(pictures.filter((p) => !hasIcon(p))).toEqual([]);
  });

  it("keeps ISEE passages long enough to carry a vocabulary question", () => {
    for (const p of ISEE_BANKS.passages) {
      expect(p.text.split(/\s+/).length, p.mainIdea.slice(0, 40)).toBeGreaterThanOrEqual(80);
    }
  });
});

describe("CogAT items", () => {
  const cogat = skillsFor("cogat", 1);

  it("covers all three batteries", () => {
    expect(new Set(cogat.map((s) => s.strand))).toEqual(
      new Set(["Verbal Battery", "Quantitative Battery", "Nonverbal Battery"]),
    );
  });

  it("gives every nonverbal option a picture", () => {
    // A nonverbal item whose options arrive as bare letters is unanswerable:
    // the letters are labels, and the figures are the question.
    const nonverbal = cogat.filter((s) => s.strand === "Nonverbal Battery");
    expect(nonverbal.length).toBeGreaterThan(0);
    for (const skill of nonverbal) {
      for (let level = 1; level <= (skill.levels ?? 4); level++) {
        for (const seed of SEEDS) {
          const q = generateQuestion(skill, level, seed);
          const where = `${skill.id} L${level} seed ${seed}`;
          expect(q.figure, `${where}: no prompt figure`).toBeTruthy();
          if (q.format.kind !== "choice") throw new Error(`${where}: not multiple choice`);
          expect(q.format.figures, `${where}: no option figures`).toBeDefined();
          expect(q.format.figures!.length, where).toBe(q.format.choices.length);
          expect(new Set(q.format.figures).size, `${where}: two options drew the same picture`).toBe(
            q.format.figures!.length,
          );
        }
      }
    }
  });

  it("answers every verbal item with a picture", () => {
    // The whole verbal battery is picture-based at Level 7, sentence
    // completion included: the sentence is read aloud and the child points at
    // a picture. An option that arrives as a bare word is the item the format
    // was designed to avoid.
    const verbal = cogat.filter((s) => s.strand === "Verbal Battery");
    expect(verbal.length).toBe(3);
    for (const id of verbal.map((s) => s.id)) {
      const skill = SKILLS.find((s) => s.id === id)!;
      expect(skill, id).toBeDefined();
      for (let level = 1; level <= 4; level++) {
        for (const seed of SEEDS) {
          const q = generateQuestion(skill, level, seed);
          const where = `${id} L${level} seed ${seed}`;
          // Sentence completion prompts with a sentence, not a picture -- it
          // is read aloud. The other two show the pictures being reasoned
          // about. Either way the *options* are pictures.
          if (id !== "cogat-1-sentence-completion") expect(q.figure, where).toContain("<svg");
          if (q.format.kind !== "choice") throw new Error(`${where}: not multiple choice`);
          expect(q.format.figures?.length, where).toBe(q.format.choices.length);
          // Artwork, not a glyph standing in for it.
          for (const figure of q.format.figures!) expect(figure, where).toContain("<path");
        }
      }
    }
  });

  it("never offers a first grader a negative number", () => {
    const quantitative = cogat.filter((s) => s.strand === "Quantitative Battery");
    for (const skill of quantitative) {
      for (let level = 1; level <= (skill.levels ?? 4); level++) {
        for (const seed of SEEDS) {
          const q = generateQuestion(skill, level, seed);
          const shown = [q.stem, q.answer, ...(q.format.kind === "choice" ? q.format.choices : [])].join(" ");
          // A sign sits against its number ("−4"); the subtraction operator
          // is spaced ("7 − 4"), which is why this looks for the tight form.
          expect(/[−-]\d/.test(shown), `${skill.id} L${level} seed ${seed}: ${q.stem}`).toBe(false);
        }
      }
    }
  });

  it("applies one rule to both rows of a number analogy", () => {
    // The keyed option is checked against the picture, not against the
    // generator's own arithmetic: the child answers by counting what is drawn.
    const skill = SKILLS.find((s) => s.id === "cogat-1-number-analogies")!;
    for (let level = 1; level <= 4; level++) {
      for (const seed of SEEDS) {
        const q = generateQuestion(skill, level, seed);
        const where = `${skill.id} L${level} seed ${seed}`;
        const label = /aria-label="([^"]*)"/.exec(q.figure ?? "")?.[1] ?? "";
        // Objects can be two words ("ice cream"), so the counts are read by
        // position around the verb rather than by counting words.
        const [, from, to, bottomFrom] = /^(\d+) [^.]*?becomes? (\d+) [^.]*\. (\d+) /.exec(label)!;
        if (q.format.kind !== "choice") throw new Error(`${where}: not multiple choice`);
        const keyed = q.format.figures![q.format.choices.indexOf(q.answer)];
        const answer = Number(/aria-label="(\d+) /.exec(keyed)![1]);
        expect(answer, `${where}: ${label}`).toBe(Number(bottomFrom) + (Number(to) - Number(from)));
        // Nothing on the page counts past what a six-year-old can take in.
        for (const n of [from, to, bottomFrom, `${answer}`]) {
          expect(Number(n), where).toBeGreaterThanOrEqual(1);
          expect(Number(n), where).toBeLessThanOrEqual(6);
        }
      }
    }
  });

  it("draws the quantitative battery instead of writing it", () => {
    // Level 7 asks number series on an abacus and number puzzles on trains,
    // and the reason is not decoration: a six-year-old who has to read the
    // item is being tested on reading, not on quantitative reasoning.
    for (const id of ["cogat-1-number-series", "cogat-1-number-puzzles", "cogat-1-number-analogies"]) {
      const skill = SKILLS.find((s) => s.id === id)!;
      expect(skill, id).toBeDefined();
      for (let level = 1; level <= 4; level++) {
        for (const seed of SEEDS) {
          const q = generateQuestion(skill, level, seed);
          expect(q.figure, `${id} L${level} seed ${seed}`).toBeTruthy();
        }
      }
    }
  });

  it("draws every counter inside its own figure", () => {
    // A bead stacked past the top of a rod is not clipped loudly -- it simply
    // is not there, and the child counts a rod that is missing beads. Same for
    // dots pushed out of a train car.
    const counting = ["cogat-1-number-series", "cogat-1-number-puzzles"];
    for (const id of counting) {
      const skill = SKILLS.find((s) => s.id === id)!;
      for (let level = 1; level <= 4; level++) {
        for (const seed of SEEDS) {
          const q = generateQuestion(skill, level, seed);
          const figures = [q.figure!, ...(q.format.kind === "choice" ? (q.format.figures ?? []) : [])];
          for (const svg of figures) {
            for (const spill of outsideViewBox(svg)) {
              expect.fail(`${id} L${level} seed ${seed}: ${spill}`);
            }
          }
        }
      }
    }
  });

  it("keeps every abacus rod inside what a child can count", () => {
    const skill = SKILLS.find((s) => s.id === "cogat-1-number-series")!;
    for (let level = 1; level <= 4; level++) {
      for (const seed of SEEDS) {
        const q = generateQuestion(skill, level, seed);
        const figures = [q.figure!, ...(q.format.kind === "choice" ? (q.format.figures ?? []) : [])];
        for (const beads of figures.flatMap(beadCounts)) {
          expect(beads, `${skill.id} L${level} seed ${seed}: ${beads} beads on one rod`).toBeGreaterThanOrEqual(1);
          expect(beads, `${skill.id} L${level} seed ${seed}: ${beads} beads on one rod`).toBeLessThanOrEqual(10);
        }
      }
    }
  });

  it("loads both trains to the same total", () => {
    // The keyed answer is what evens the trains up. Checked against the
    // picture rather than against the generator's own arithmetic: the child
    // answers by counting dots, so it is the dots that have to add up.
    const skill = SKILLS.find((s) => s.id === "cogat-1-number-puzzles")!;
    for (let level = 1; level <= 4; level++) {
      for (const seed of SEEDS) {
        const q = generateQuestion(skill, level, seed);
        const [, first, second] = /The first has (.*)\. The second has (.*)\./.exec(
          /aria-label="([^"]*)"/.exec(q.figure ?? "")?.[1] ?? "",
        )!;
        const carried = (s: string) => [...s.matchAll(/a car with (\d+)/g)].reduce((n, m) => n + Number(m[1]), 0);
        expect(carried(first), `${skill.id} L${level} seed ${seed}`).toBe(carried(second) + Number(q.answer));
        for (const [, n] of [...`${first} ${second}`.matchAll(/a car with (\d+)/g)]) {
          expect(Number(n), "dots in one car").toBeLessThanOrEqual(9);
        }
      }
    }
  });

  it("unfolds a punched hole onto both sides of the crease", () => {
    // One punch through two layers is two holes, mirrored about the fold.
    expect(unfoldHoles([{ col: 0, row: 1 }], "vertical")).toEqual([
      { col: 0, row: 1 },
      { col: 3, row: 1 },
    ]);
    expect(unfoldHoles([{ col: 2, row: 0 }], "horizontal")).toEqual([
      { col: 2, row: 0 },
      { col: 2, row: 3 },
    ]);
  });
});

/** Circles in an SVG that fall outside its viewBox, described for a failure. */
function outsideViewBox(svg: string): string[] {
  const [, w, h] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)!.map(Number);
  const out: string[] = [];
  for (const m of svg.matchAll(/<circle cx="([\d.]+)" cy="(-?[\d.]+)" r="([\d.]+)"/g)) {
    const [cx, cy, r] = m.slice(1).map(Number);
    if (cy - r < 0 || cy + r > h || cx - r < 0 || cx + r > w) {
      out.push(`a circle at (${cx}, ${cy}) r=${r} falls outside the ${w}x${h} figure`);
    }
  }
  return out;
}

/** Bead counts read back out of an abacus figure's description. */
function beadCounts(figure: string): number[] {
  const label = /aria-label="([^"]*)"/.exec(figure)?.[1] ?? "";
  return [...label.matchAll(/(\d+) beads?/g)].map((m) => Number(m[1]));
}

describe("ISEE items", () => {
  const isee = skillsFor("isee", 6);
  const qc = isee.find((s) => s.generator === "isee-quantitative-comparison")!;
  const manySeeds = Array.from({ length: 90 }, (_, i) => i * 613 + 5);

  it("covers all four scored sections", () => {
    expect(new Set(isee.map((s) => s.strand))).toEqual(
      new Set(["Verbal Reasoning", "Quantitative Reasoning", "Reading Comprehension", "Mathematics Achievement"]),
    );
  });

  it("reuses the math catalog for Mathematics Achievement rather than forking it", () => {
    const mathGenerators = new Set(SKILLS.filter((s) => s.subject === "math").map((s) => s.generator));
    const achievement = isee.filter((s) => s.strand === "Mathematics Achievement");
    expect(achievement.length).toBeGreaterThan(5);
    for (const skill of achievement) {
      expect(mathGenerators.has(skill.generator), `${skill.id} uses ${skill.generator}`).toBe(true);
    }
  });

  it("offers every quantitative-comparison verdict", () => {
    // Including "cannot be determined", which is the option students skip --
    // a form that never keys it teaches them to keep skipping it.
    const keyed = new Set<string>();
    for (let level = 1; level <= 4; level++) {
      for (const seed of manySeeds) keyed.add(generateQuestion(qc, level, seed).answer);
    }
    expect(keyed.size).toBe(4);
  });

  it("never keys 'cannot be determined' for a fully specified comparison", () => {
    // With no unknown on the page, both columns evaluate, so the relationship
    // is always determined -- keying otherwise would be teaching a wrong rule.
    const wrong: string[] = [];
    for (let level = 1; level <= 4; level++) {
      for (const seed of manySeeds) {
        const q = generateQuestion(qc, level, seed);
        const hasUnknown = /\b[xn]\b/.test(q.stem);
        if (!hasUnknown && q.answer.includes("cannot be determined")) {
          wrong.push(`L${level} seed ${seed}: ${q.stem.replace(/\n/g, " ")}`);
        }
      }
    }
    expect(wrong.slice(0, 5)).toEqual([]);
  });

  it("keeps the quantitative-comparison options in their standard order", () => {
    // Shuffling them would make a familiar item unrecognisable: on the real
    // test, "the two quantities are equal" is always C.
    const q = generateQuestion(qc, 2, 4242);
    if (q.format.kind !== "choice") throw new Error("expected a multiple-choice item");
    expect(q.format.choices[0]).toContain("Column A is greater");
    expect(q.format.choices[1]).toContain("Column B is greater");
    expect(q.format.choices[2]).toContain("equal");
    expect(q.format.choices[3]).toContain("cannot be determined");
  });

  it("asks a different question of the passage for each reading skill", () => {
    const reading = isee.filter((s) => s.generator === "isee-reading");
    expect(reading.length).toBe(5);
    const asked = new Set(reading.map((s) => generateQuestion(s, 4, 21).instructions));
    expect(asked.size).toBe(reading.length);
  });
});
