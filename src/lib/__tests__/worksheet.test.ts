import { describe, expect, it } from "vitest";
import { questionRequest } from "../api-schema";
import { SKILLS, skillsFor } from "../curriculum";
import { generateQuestion } from "../generators";
import { newSeed } from "../rng";
import {
  DEFAULT_QUESTIONS,
  MAX_QUESTIONS,
  MIN_QUESTIONS,
  WORKSHEET_SEED_BASE,
  itemSeed,
  parseSpec,
  planWorksheet,
  rawQuery,
  specToQuery,
  type WorksheetSpec,
} from "../worksheet";
import { fillWorksheet, identity } from "../worksheet-questions";

function spec(overrides: Partial<WorksheetSpec> = {}): WorksheetSpec {
  return {
    subject: "math",
    grade: 5,
    skillIds: [],
    count: DEFAULT_QUESTIONS,
    level: "mixed",
    seed: 12345,
    columns: 1,
    workSpace: false,
    answerKey: false,
    ...overrides,
  };
}

describe("worksheet planning", () => {
  it("produces exactly the requested number of questions", () => {
    for (const count of [MIN_QUESTIONS, 7, 20, MAX_QUESTIONS]) {
      expect(planWorksheet(spec({ count })).items).toHaveLength(count);
    }
  });

  it("is deterministic in its spec", () => {
    const a = planWorksheet(spec());
    const b = planWorksheet(spec());
    expect(b.items).toEqual(a.items);
  });

  it("gives a different sheet for a different seed", () => {
    const a = planWorksheet(spec({ seed: 1 })).items.map((i) => i.seed);
    const b = planWorksheet(spec({ seed: 2 })).items.map((i) => i.seed);
    expect(b).not.toEqual(a);
  });

  it("draws only from the requested grade", () => {
    for (const { subject, grade } of [
      { subject: "math", grade: 0 },
      { subject: "math", grade: 9 },
      { subject: "ela", grade: 4 },
    ] as const) {
      const plan = planWorksheet(spec({ subject, grade }));
      const stray = plan.items.filter((i) => i.skill.subject !== subject || i.skill.grade !== grade);
      expect(stray).toEqual([]);
    }
  });

  it("restricts to the chosen skills", () => {
    const chosen = skillsFor("math", 5).slice(0, 2).map((s) => s.id);
    const plan = planWorksheet(spec({ skillIds: chosen }));
    expect([...new Set(plan.items.map((i) => i.skill.id))].sort()).toEqual([...chosen].sort());
  });

  it("splits the sheet evenly across the skills it uses", () => {
    const plan = planWorksheet(spec({ count: 20 }));
    const counts = new Map<string, number>();
    for (const item of plan.items) counts.set(item.skill.id, (counts.get(item.skill.id) ?? 0) + 1);
    const sizes = [...counts.values()];
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it("keeps each skill's questions together and numbers them 1..n", () => {
    const plan = planWorksheet(spec({ count: 20 }));
    expect(plan.items.map((i) => i.number)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    const order = plan.items.map((i) => i.skill.id);
    const firstSeen = new Map<string, number>();
    order.forEach((id, i) => firstSeen.has(id) || firstSeen.set(id, i));
    // A skill never reappears after another skill has started.
    order.forEach((id, i) => {
      if (i > 0 && order[i - 1] !== id) expect(firstSeen.get(id)).toBe(i);
    });
  });

  it("never asks for a level a skill does not have", () => {
    for (const level of ["mixed", 1, 2, 3, 4, 8] as const) {
      for (const item of planWorksheet(spec({ level, count: MAX_QUESTIONS })).items) {
        expect(item.level).toBeGreaterThanOrEqual(1);
        expect(item.level).toBeLessThanOrEqual(item.skill.levels ?? 4);
      }
    }
  });

  it("pins every item to one level when a level is chosen", () => {
    const levels = planWorksheet(spec({ level: 2 })).items.map((i) => i.level);
    expect([...new Set(levels)]).toEqual([2]);
  });

  it("ramps a single skill from its easiest tier to its hardest", () => {
    const one = skillsFor("math", 5)[0];
    const plan = planWorksheet(spec({ skillIds: [one.id], count: MIN_QUESTIONS }));
    expect(plan.items[0].level).toBe(1);
    expect(plan.items[plan.items.length - 1].level).toBe(one.levels ?? 4);
  });

  it("does not stick a skill's lone question on the easiest tier", () => {
    // A mixed sheet spreads thin across a big grade; level 1 for every skill
    // would make it trivial.
    const one = skillsFor("math", 5)[0];
    const plan = planWorksheet(spec({ skillIds: [one.id], count: 1 }));
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].level).toBeGreaterThan(1);
  });

  it("generates a well-formed question with an answer for every item", () => {
    // Worksheets print the answer key, so a blank answer is a broken sheet.
    const grades = [...new Set(SKILLS.map((s) => `${s.subject}:${s.grade}`))];
    for (const key of grades) {
      const [subject, grade] = key.split(":");
      const plan = planWorksheet(
        spec({ subject: subject as "math" | "ela", grade: Number(grade), count: MAX_QUESTIONS }),
      );
      for (const item of plan.items) {
        const q = generateQuestion(item.skill, item.level, item.seed);
        expect(q.stem.trim(), `${item.skill.id} stem`).not.toBe("");
        expect(q.answer.trim(), `${item.skill.id} answer`).not.toBe("");
        if (q.format.kind === "choice") {
          expect(q.format.choices, `${item.skill.id} choices`).toContain(q.answer);
        }
      }
    }
  });
});

describe("worksheet seeds stay out of the practice seed space", () => {
  /**
   * The point of the split: a worksheet prints answers, practice does not.
   * If the two seed spaces overlapped, a learner could read the answer to the
   * question they were being graded on straight off a crafted worksheet URL.
   */
  it("derives every item seed at or above the worksheet base", () => {
    // Well past the largest sheet: a repeated question is re-derived from an
    // index thousands past its own, and those seeds have to stay in the
    // worksheet space too.
    for (const seed of [0, 1, 999, 2 ** 30, WORKSHEET_SEED_BASE - 1]) {
      for (let i = 0; i < 9000; i++) {
        const s = itemSeed(seed, i);
        expect(s).toBeGreaterThanOrEqual(WORKSHEET_SEED_BASE);
        expect(s).toBeLessThan(2 ** 32);
        expect(Number.isInteger(s)).toBe(true);
      }
    }
  });

  it("keeps practice seeds strictly below the worksheet base", () => {
    for (let i = 0; i < 500; i++) expect(newSeed()).toBeLessThan(WORKSHEET_SEED_BASE);
  });

  it("makes the question and grading endpoints reject a worksheet seed", () => {
    const worksheetSeed = itemSeed(42, 0);
    expect(questionRequest.safeParse({ skillId: "math-5-x", level: 1, seed: worksheetSeed }).success)
      .toBe(false);
    expect(questionRequest.safeParse({ skillId: "math-5-x", level: 1, seed: newSeed() }).success)
      .toBe(true);
  });

  it("varies item seeds within a sheet", () => {
    const seeds = planWorksheet(spec({ count: MAX_QUESTIONS })).items.map((i) => i.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
  });
});

describe("filling a sheet with questions", () => {
  /**
   * A skill backed by a content bank picks an item rather than inventing one,
   * so the same sentence can come up twice on one sheet. On screen that reads
   * as chance; on paper, next to itself, it reads as a mistake.
   */
  it("does not ask the same question twice on one sheet", () => {
    const banked = ["cogat-1-sentence-completion", "cogat-1-picture-analogies", "ela-2-synonyms"];
    for (const skillId of banked) {
      const skill = SKILLS.find((s) => s.id === skillId);
      expect(skill, skillId).toBeDefined();
      for (const seed of [1, 7, 4242, 99999]) {
        const plan = planWorksheet(spec({ subject: skill!.subject, grade: skill!.grade, skillIds: [skillId], count: 8, seed }));
        const asked = fillWorksheet(plan).map((i) => identity(i.question));
        expect(new Set(asked).size, `${skillId} seed ${seed}`).toBe(asked.length);
      }
    }
  });

  it("keeps a filled sheet reproducible from its seed", () => {
    // The de-duplication retries deterministically, so the sheet is still a
    // pure function of its URL.
    const plan = planWorksheet(spec({ subject: "cogat", grade: 1, skillIds: ["cogat-1-sentence-completion"], count: 8, seed: 31337 }));
    const once = fillWorksheet(plan).map((i) => `${i.seed}:${identity(i.question)}`);
    const twice = fillWorksheet(planWorksheet(plan.spec)).map((i) => `${i.seed}:${identity(i.question)}`);
    expect(once).toEqual(twice);
  });

  it("keeps every seed it lands on inside the worksheet space", () => {
    const plan = planWorksheet(spec({ subject: "cogat", grade: 1, skillIds: ["cogat-1-sentence-completion"], count: 12, seed: 5 }));
    for (const item of fillWorksheet(plan)) {
      expect(item.seed).toBeGreaterThanOrEqual(WORKSHEET_SEED_BASE);
      expect(item.seed).toBeLessThan(2 ** 32);
    }
  });
});

describe("worksheet urls", () => {
  const params = (query: string) => Object.fromEntries(new URLSearchParams(query));

  it("round-trips a spec", () => {
    const original = spec({
      skillIds: skillsFor("ela", 3).slice(0, 2).map((s) => s.id),
      subject: "ela",
      grade: 3,
      count: 12,
      level: 3,
      columns: 2,
      workSpace: true,
      answerKey: true,
    });
    expect(parseSpec(params(specToQuery(original)))).toEqual(original);
  });

  it("reaches a fixed point, so the print route redirects at most once", () => {
    for (const query of [
      "subject=math&grade=5",
      "subject=math&grade=5&count=999&level=9&cols=3&work=0&key=0",
      "subject=ela&grade=2&skills=nope,also-nope&seed=zzz",
    ]) {
      const first = specToQuery(parseSpec(params(query))!);
      expect(rawQuery(params(first))).toBe(first);
      expect(specToQuery(parseSpec(params(first))!)).toBe(first);
    }
  });

  it("clamps the question count instead of failing", () => {
    expect(parseSpec(params("subject=math&grade=5&count=900"))!.count).toBe(MAX_QUESTIONS);
    expect(parseSpec(params("subject=math&grade=5&count=1"))!.count).toBe(MIN_QUESTIONS);
    expect(parseSpec(params("subject=math&grade=5&count=junk"))!.count).toBe(DEFAULT_QUESTIONS);
  });

  it("drops skill ids that are not in the grade", () => {
    const real = skillsFor("math", 5)[0].id;
    const parsed = parseSpec(params(`subject=math&grade=5&skills=${real},math-2-place-value,bogus`));
    expect(parsed!.skillIds).toEqual([real]);
  });

  it("rejects a subject or grade we do not teach", () => {
    for (const query of ["subject=science&grade=5", "subject=math&grade=42", "grade=5"]) {
      expect(parseSpec(params(query))).toBeNull();
    }
  });

  it("invents a seed only when the url has no usable one", () => {
    expect(parseSpec(params("subject=math&grade=5&seed=9ix"))!.seed).toBe(parseInt("9ix", 36));
    const invented = parseSpec(params("subject=math&grade=5"))!.seed;
    expect(invented).toBeGreaterThanOrEqual(0);
    expect(invented).toBeLessThan(WORKSHEET_SEED_BASE);
  });
});
