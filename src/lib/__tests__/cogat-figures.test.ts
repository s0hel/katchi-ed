import { describe, expect, it } from "vitest";
import { skillsFor } from "../curriculum";
import { generateQuestion } from "../generators";
import { figLook, sameLook, type Fig } from "../generators/shapes";

const SEEDS = Array.from({ length: 240 }, (_, i) => i * 7919 + 13);

const ANALOGIES = skillsFor("cogat", 1).find((s) => s.generator === "cogat-figure-analogies")!;
const CLASSIFICATION = skillsFor("cogat", 1).find((s) => s.generator === "cogat-figure-classification")!;

/** An option's drawing, with the words stripped off. */
const drawing = (svg: string) => svg.replace(/aria-label="[^"]*"/, "").replace(/\s+/g, " ");

/** The rule an item was built on: the clause the explanation opens with. */
const ruleOf = (explanation: string) => explanation.split(":")[0];

/** What a classification group had in common: the clause after the colon. */
const kinshipOf = (explanation: string) => explanation.split(": ")[1].split(". Only")[0];

/** Every option's drawing, for the skill named. */
function options(skill: typeof ANALOGIES, level: number, seed: number): string[] {
  const q = generateQuestion(skill, level, seed);
  return q.format.kind === "choice" ? (q.format.figures ?? []).map(drawing) : [];
}

const fig = (over: Partial<Fig>): Fig => ({ shape: "arrow", shading: "open", size: 2, count: 1, ...over });

/**
 * The figure kit compares figures by what they draw, not by what they claim.
 *
 * Every one of these is a rule that would otherwise ship a broken item: an
 * analogy whose answer is indistinguishable from its question, or two options
 * that draw the same picture and cannot both be wrong.
 */
describe("figure geometry", () => {
  it("sees a turn that shows", () => {
    expect(sameLook(fig({ shape: "arrow" }), fig({ shape: "arrow", turn: 1 }))).toBe(false);
    expect(sameLook(fig({ shape: "triangle" }), fig({ shape: "triangle", turn: 2 }))).toBe(false);
  });

  it("sees through a turn that does not", () => {
    // A circle has no orientation to change, and a square meets itself every
    // quarter turn. Both are rules a child would be asked to read off a
    // picture that never moved.
    expect(sameLook(fig({ shape: "circle" }), fig({ shape: "circle", turn: 1 }))).toBe(true);
    expect(sameLook(fig({ shape: "square" }), fig({ shape: "square", turn: 3 }))).toBe(true);
    expect(sameLook(fig({ shape: "hexagon" }), fig({ shape: "hexagon", turn: 2 }))).toBe(true);
  });

  it("sees a mirror only where there is one to see", () => {
    expect(sameLook(fig({ shape: "ell" }), fig({ shape: "ell", flip: true }))).toBe(false);
    expect(sameLook(fig({ shape: "star" }), fig({ shape: "star", flip: true }))).toBe(true);
  });

  it("knows when a mirror and a half turn come to the same thing", () => {
    // This is the trap the analogy driver checks for: a first pair of arrows
    // can be read as either rule, and the two readings part company the moment
    // the second pair is a shape that is its own mirror image.
    expect(sameLook(fig({ shape: "arrow", flip: true }), fig({ shape: "arrow", turn: 2 }))).toBe(true);
    expect(sameLook(fig({ shape: "ell", flip: true }), fig({ shape: "ell", turn: 2 }))).toBe(false);
  });

  it("does not mind which order a row was drawn in", () => {
    // Mirroring a row of two hands back the same two circles the other way
    // round. Comparing the drawing in order would call that a change, and
    // "each one has two matching halves" would then be true of almost nothing.
    const row = fig({ shape: "circle", count: 2, size: 1 });
    expect(sameLook(row, { ...row, flip: true })).toBe(true);
    // Within one shape the order is the stacking, and that does show.
    const one = fig({ shape: "square" });
    expect(sameLook({ ...one, ghost: true }, { ...one, extruded: true })).toBe(false);
  });

  it("turns the middle shape on its own", () => {
    // "Two arrows up, one down" is one figure, not three, so the middle one
    // has to turn about its own centre while the other two stay put.
    const three = fig({ shape: "arrow", count: 3, size: 1 });
    expect(sameLook(three, { ...three, odd: { turn: 2 } })).toBe(false);
    // ...and only ever the middle of three.
    const two = fig({ shape: "arrow", count: 2, size: 1 });
    expect(sameLook(two, { ...two, odd: { turn: 2 } })).toBe(true);
  });

  it("turns the whole figure, not each shape in it", () => {
    // Three in a row, turned, is a column -- which is a change a child can see
    // even though every circle in it is unmoved.
    const row = fig({ shape: "circle", count: 3, size: 1 });
    expect(sameLook(row, { ...row, turn: 1 })).toBe(false);
  });

  it("draws each added feature differently", () => {
    const base = fig({ shape: "square" });
    const looks = [
      figLook(base),
      figLook({ ...base, count: 3, odd: { shape: "circle" } }),
      figLook({ ...base, count: 3, odd: { smaller: true } }),
      figLook({ ...base, count: 3 }),
      figLook({ ...base, ghost: true }),
      figLook({ ...base, extruded: true }),
      figLook({ ...base, split: true }),
      figLook({ ...base, inner: { shapes: ["circle", "circle"], at: "inside" } }),
      figLook({ ...base, inner: { shapes: ["circle", "heart"], at: "inside" } }),
      figLook({ ...base, inner: { shapes: ["circle"], at: "above" } }),
      figLook({ ...base, pair: "big-small" }),
      figLook({ ...base, pair: "small-big" }),
      figLook({ ...base, shape: "oval" }),
    ];
    expect(new Set(looks).size).toBe(looks.length);
  });
});

describe("figure analogies", () => {
  it("never draws two options the same", () => {
    const clashes: number[] = [];
    for (const seed of SEEDS) {
      const q = generateQuestion(ANALOGIES, 4, seed);
      if (q.format.kind !== "choice" || !q.format.figures) continue;
      const drawn = q.format.figures.map(drawing);
      if (new Set(drawn).size !== drawn.length) clashes.push(seed);
    }
    expect(clashes.slice(0, 5)).toEqual([]);
  });

  /**
   * The complaint that started this: a session kept meeting the same rule.
   * The old generator had four, and only two of them below level three.
   */
  it("draws on many rules, and leans on none of them", () => {
    for (const level of [1, 2, 3, 4]) {
      const used = new Map<string, number>();
      for (const seed of SEEDS) {
        const rule = ruleOf(generateQuestion(ANALOGIES, level, seed).explanation);
        used.set(rule, (used.get(rule) ?? 0) + 1);
      }
      const commonest = Math.max(...used.values()) / SEEDS.length;
      expect({ level, rules: used.size, commonest: commonest < 0.3 }).toEqual({
        level,
        rules: used.size,
        commonest: true,
      });
      expect(used.size).toBeGreaterThanOrEqual(level === 1 ? 6 : level === 2 ? 9 : level === 3 ? 15 : 18);
    }
  });

  it("asks a harder set of rules at the top than at the bottom", () => {
    const rules = (level: number) =>
      new Set(SEEDS.map((seed) => ruleOf(generateQuestion(ANALOGIES, level, seed).explanation)));
    const bottom = rules(1);
    const top = rules(4);
    // Everything the bottom tier knows, the top tier still asks -- a ramp adds
    // rules, it does not trade them.
    expect([...bottom].filter((r) => !top.has(r))).toEqual([]);
    expect(top.size).toBeGreaterThan(bottom.size);
  });
});

describe("figure classification", () => {
  it("never draws two options the same", () => {
    const clashes: number[] = [];
    for (const seed of SEEDS) {
      const drawn = options(CLASSIFICATION, 4, seed);
      if (drawn.length && new Set(drawn).size !== drawn.length) clashes.push(seed);
    }
    expect(clashes.slice(0, 5)).toEqual([]);
  });

  /**
   * The same complaint as the analogies, and it was worse here: below level 4
   * the shared thing was not chosen at all. Level 1 was always the shape,
   * level 2 always how many, level 3 always how dark.
   */
  it("finds many things for three pictures to have in common", () => {
    const floors: Record<number, number> = { 1: 12, 2: 16, 3: 24, 4: 30 };
    for (const level of [1, 2, 3, 4]) {
      const used = new Map<string, number>();
      for (const seed of SEEDS) {
        const kin = kinshipOf(generateQuestion(CLASSIFICATION, level, seed).explanation);
        used.set(kin, (used.get(kin) ?? 0) + 1);
      }
      const commonest = Math.max(...used.values()) / SEEDS.length;
      expect({ level, kinships: used.size, commonest: commonest < 0.3 }).toEqual({
        level,
        kinships: used.size,
        commonest: true,
      });
      expect(used.size).toBeGreaterThanOrEqual(floors[level]);
    }
  });

  it("keeps the bottom tier's rules and adds to them", () => {
    const kinds = (level: number) =>
      new Set(SEEDS.map((seed) => kinshipOf(generateQuestion(CLASSIFICATION, level, seed).explanation)));
    expect(kinds(4).size).toBeGreaterThan(kinds(1).size);
  });
});

describe("figures that can be read", () => {
  /**
   * A shape drawn in the fill colour of the shape behind it is on the page and
   * not on the paper. `figLook` compares what is drawn rather than what shows,
   * so it lets two options through as different when one of them is a filled
   * pentagon and the other is a filled pentagon with filled pentagons inside.
   */
  it("never hides a figure's contents inside a filled shape", () => {
    const hidden: string[] = [];
    for (const skill of [ANALOGIES, CLASSIFICATION]) {
      for (const seed of SEEDS) {
        const q = generateQuestion(skill, 4, seed);
        if (q.format.kind !== "choice") continue;
        for (const svg of q.format.figures ?? []) {
          const label = /aria-label="([^"]*)"/.exec(svg)?.[1] ?? "";
          if (/solid [\w-]+s?,? with .*inside/.test(label)) hidden.push(label);
        }
      }
    }
    expect(hidden.slice(0, 3)).toEqual([]);
  });
});
