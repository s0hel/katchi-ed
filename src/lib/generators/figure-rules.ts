import {
  ROOMY, ROUND, SHADINGS, SHAPES, SHAPE_WORDS, SIDES, article, opposite, sameLook,
  type Fig, type Shading, type ShapeName,
} from "./shapes";
import type { Rng } from "../rng";

/**
 * Choosing figures, and changing them by a rule.
 *
 * `shapes.ts` draws a figure; this decides which figure to draw and what
 * happens to it. The two are split because two exams want the same rules over
 * the same figures and ask different questions of them: CogAT prints an
 * analogy as two rows joined by an arrow for a six-year-old, and the NGAT
 * prints the same reasoning as a matrix for a fourth grader. Duplicating
 * twenty transformations to serve both would guarantee they drifted apart.
 *
 * Everything here is total and seeded: a rule handed a figure it cannot act on
 * returns it unchanged, because the drivers run every rule over every other
 * rule's figures to build distractors.
 */

/**
 * The rules a figure analogy can be built on.
 *
 * The old set had four -- darker, bigger, one more, becomes-a-square -- and at
 * the bottom tier only the first two, so a session came back to the same two
 * ideas over and over. These are the transformations the practice books
 * actually use, and they are the point of the item: an analogy is only as good
 * as the number of rules a child cannot predict.
 *
 * A rule owns both halves of its item. It builds a figure it can act on --
 * "the inner shape moves out" needs a figure with an inner shape to move --
 * and it transforms one. Every `to` is total: a rule that meets a figure it
 * cannot act on returns it unchanged, because the driver also runs rules over
 * *other* rules' figures to build distractors.
 */
export interface Rule {
  /** How the change reads in the explanation. */
  words: string;
  /** A figure this rule can act on. */
  start: (rng: Rng) => Fig;
  to: (f: Fig) => Fig;
}

export interface RuleMaker {
  id: string;
  /** The lowest level this rule appears at. */
  tier: 1 | 2 | 3 | 4;
  make: (rng: Rng) => Rule;
}

/** A figure with nothing added: the starting point most rules build on. */
export function plain(rng: Rng, shape: ShapeName, over: Partial<Fig> = {}): Fig {
  return { shape, shading: rng.pick(SHADINGS), size: rng.pick([1, 2] as const), count: 1, ...over };
}

export const anyShape = (rng: Rng) => rng.pick(SHAPES);

/**
 * Shapes whose quarter turn is visible.
 *
 * A circle, a square and a diamond all survive one unchanged. `sameLook`
 * catches a rule that shows nothing either way, but starting from here means
 * the driver rarely has to throw an item away.
 */
export const TURNABLE: ShapeName[] = ["arrow", "ell", "triangle", "star", "hexagon", "parallelogram", "heart"];
/**
 * Shapes a half turn moves. A hexagon is its own upside down, and so is a
 * parallelogram -- slanted, it is nobody's mirror image, but turn it all the
 * way over and it lands back on itself.
 */
export const HALF_TURNABLE: ShapeName[] = ["arrow", "ell", "triangle", "star", "heart"];

/**
 * A figure a quarter turn is bound to move.
 *
 * Either one shape with an orientation to lose, or a row of them -- a row
 * turned a quarter is a column, which is a change even when every circle in
 * it is exactly where it was. The row is worth having: it is the one way a
 * turn rule gets to use the shapes that have no orientation of their own.
 */
export const turnable = (rng: Rng): Fig =>
  rng.bool(0.45)
    ? plain(rng, anyShape(rng), { size: 1, count: rng.pick([2, 3] as const) })
    : plain(rng, rng.pick(TURNABLE), { size: 2 });
/** Shapes that are not their own mirror image. */
export const FLIPPABLE: ShapeName[] = ["arrow", "ell", "parallelogram"];
/** A half can only be cut off a straight-edged shape. */
export const SPLITTABLE: ShapeName[] = SHAPES.filter((s) => s !== "circle");

/**
 * Shapes too alike to hold apart at the size these are drawn.
 *
 * A circle and an oval are different shapes and a six-year-old cannot be
 * asked to prove it across two small boxes. So wherever an item needs a shape
 * that is *not* the one it started from -- an odd middle, a wrong option, the
 * second pair of an analogy -- it needs one that reads as different, not one
 * that merely is. The round kinship is the exception and asks for both on
 * purpose, because there the point is that neither has corners.
 */
export const TWINS: Partial<Record<ShapeName, ShapeName[]>> = { circle: ["oval"], oval: ["circle"] };

/** Shapes a child would not mistake for `shape`. */
export const unlike = (shape: ShapeName): ShapeName[] =>
  SHAPES.filter((s) => s !== shape && !(TWINS[shape] ?? []).includes(s));

/** Shapes that trade places, so the rule reads as a swap rather than a rename. */
export const SWAPS: [ShapeName, ShapeName][] = [
  ["star", "circle"], ["square", "triangle"], ["diamond", "hexagon"], ["arrow", "ell"],
];

export const DARKER: Record<Shading, Shading> = { open: "shaded", shaded: "solid", solid: "solid" };
export const LIGHTER: Record<Shading, Shading> = { solid: "shaded", shaded: "open", open: "open" };

export const turnBy = (f: Fig, quarters: number): Fig => ({
  ...f,
  turn: (((f.turn ?? 0) + quarters) % 4) as 0 | 1 | 2 | 3,
});

export const plural = (s: ShapeName) => (s === "ell" ? "L-shapes" : `${s}s`);

export const RULE_MAKERS: RuleMaker[] = [
  {
    id: "grow",
    tier: 1,
    make: () => ({
      words: "the shape gets bigger",
      start: (rng) => plain(rng, anyShape(rng), { size: 1 }),
      to: (f) => ({ ...f, size: 2 }),
    }),
  },
  {
    id: "shrink",
    tier: 2,
    make: () => ({
      words: "the shape gets smaller",
      start: (rng) => plain(rng, anyShape(rng), { size: 2 }),
      to: (f) => ({ ...f, size: 1 }),
    }),
  },
  {
    id: "invert",
    tier: 1,
    make: () => ({
      words: "the colours swap over -- empty turns filled, and filled turns empty",
      start: (rng) => plain(rng, anyShape(rng), { shading: rng.pick(["open", "solid"] as Shading[]) }),
      to: (f) => (f.shading === "shaded" ? f : { ...f, shading: opposite(f.shading) }),
    }),
  },
  {
    id: "darken",
    tier: 1,
    make: () => ({
      words: "the shape gets darker",
      start: (rng) => plain(rng, anyShape(rng), { shading: rng.pick(["open", "shaded"] as Shading[]) }),
      to: (f) => ({ ...f, shading: DARKER[f.shading] }),
    }),
  },
  {
    id: "add-one",
    tier: 1,
    make: () => ({
      words: "one more shape is added",
      start: (rng) => plain(rng, anyShape(rng), { count: rng.pick([1, 2] as const), size: 1 }),
      to: (f) => ({ ...f, count: Math.min(3, f.count + 1) as 1 | 2 | 3 }),
    }),
  },
  {
    id: "swap-shape",
    tier: 1,
    make: (rng) => {
      const [x, y] = rng.pick(SWAPS);
      return {
        words: `${plural(x)} become ${plural(y)}, and ${plural(y)} become ${plural(x)}`,
        start: (r) => plain(r, r.pick([x, y])),
        to: (f) => (f.shape === x ? { ...f, shape: y } : f.shape === y ? { ...f, shape: x } : f),
      };
    },
  },
  {
    id: "ghost",
    tier: 1,
    make: () => ({
      words: "the shape doubles, with an empty copy behind it",
      start: (rng) => plain(rng, anyShape(rng), { size: 2, ghost: false }),
      to: (f) => ({ ...f, ghost: true }),
    }),
  },
  {
    id: "same",
    tier: 2,
    make: () => ({
      words: "nothing changes at all",
      start: (rng) => plain(rng, anyShape(rng), { count: rng.pick([1, 2] as const) }),
      to: (f) => f,
    }),
  },
  {
    id: "turn-cw",
    tier: 2,
    make: () => ({
      words: "the shape turns a quarter turn clockwise",
      start: turnable,
      to: (f) => turnBy(f, 1),
    }),
  },
  {
    id: "add-inner",
    tier: 2,
    make: (rng) => {
      const first = anyShape(rng);
      // Two of a kind, or one of each: "a heart and a star appear inside" is a
      // rule in its own right, and a different one to notice.
      const second = rng.bool(0.5) ? first : rng.pick(unlike(first));
      const [a, b] = [SHAPE_WORDS[first], SHAPE_WORDS[second]];
      return {
        words: first === second
          ? `two smaller ${plural(first)} appear inside the shape`
          : `a smaller ${a} and ${article(b)} ${b} appear inside the shape`,
        // A filled parent would swallow them, so the parent is an outline.
        start: (r) => plain(r, r.pick(ROOMY), { size: 2, shading: "open", inner: null }),
        // The driver runs every rule over other rules' figures to build
        // distractors, so this has to refuse the ones it cannot act on. A
        // filled pentagon given two filled pentagons inside is still a filled
        // pentagon on the page -- and `figLook` compares what is drawn, not
        // what shows, so it would let that through as a separate option.
        to: (f) =>
          f.inner || f.shading === "solid" || !ROOMY.includes(f.shape)
            ? f
            : { ...f, inner: { shapes: [first, second], at: "inside" } },
      };
    },
  },
  {
    id: "turn-ccw",
    tier: 3,
    make: () => ({
      words: "the shape turns a quarter turn anticlockwise",
      start: turnable,
      to: (f) => turnBy(f, 3),
    }),
  },
  {
    id: "turn-half",
    tier: 3,
    make: () => ({
      words: "the shape turns upside down",
      // No rows here: a row of three turned upside down is the same row.
      start: (rng) => plain(rng, rng.pick(HALF_TURNABLE), { size: 2 }),
      to: (f) => turnBy(f, 2),
    }),
  },
  {
    id: "flip",
    tier: 3,
    make: () => ({
      words: "the shape is mirrored, left for right",
      start: (rng) => plain(rng, rng.pick(FLIPPABLE), { size: 2 }),
      to: (f) => ({ ...f, flip: !f.flip }),
    }),
  },
  {
    id: "split",
    tier: 3,
    make: () => ({
      words: "the far half of the shape turns the opposite colour",
      start: (rng) => plain(rng, rng.pick(SPLITTABLE), {
        size: 2, shading: rng.pick(["open", "solid"] as Shading[]), split: false,
      }),
      to: (f) => (f.shape === "circle" || f.shading === "shaded" ? f : { ...f, split: true }),
    }),
  },
  {
    id: "extrude",
    tier: 3,
    make: () => ({
      words: "the flat shape becomes a solid block",
      start: (rng) => plain(rng, anyShape(rng), { size: 2, extruded: false }),
      to: (f) => ({ ...f, extruded: true }),
    }),
  },
  {
    id: "inner-out",
    tier: 3,
    make: (rng) => {
      const inner = rng.pick(SHAPES);
      return {
        words: "the inner shape moves out and sits above the larger one",
        start: (r) => plain(r, r.pick(ROOMY), {
          size: 2,
          shading: "open",
          inner: { shapes: [inner], at: "inside" },
        }),
        to: (f) => (f.inner?.at === "inside" ? { ...f, inner: { ...f.inner, at: "above" } } : f),
      };
    },
  },
  {
    id: "swap-pair",
    tier: 3,
    make: () => ({
      words: "the large shape and the small one swap places",
      start: (rng) => plain(rng, anyShape(rng), { pair: rng.pick(["big-small", "small-big"] as const) }),
      to: (f) => (f.pair ? { ...f, pair: f.pair === "big-small" ? "small-big" : "big-small" } : f),
    }),
  },
  {
    id: "turn-darken",
    tier: 4,
    make: () => ({
      words: "the shape turns a quarter turn clockwise and gets darker",
      start: (rng) => plain(rng, rng.pick(TURNABLE), { size: 2, shading: rng.pick(["open", "shaded"] as Shading[]) }),
      to: (f) => ({ ...turnBy(f, 1), shading: DARKER[f.shading] }),
    }),
  },
  {
    id: "flip-invert",
    tier: 4,
    make: () => ({
      words: "the shape is mirrored and its colours swap over",
      start: (rng) => plain(rng, rng.pick(FLIPPABLE), { size: 2, shading: rng.pick(["open", "solid"] as Shading[]) }),
      to: (f) => ({ ...f, flip: !f.flip, shading: f.shading === "shaded" ? f.shading : opposite(f.shading) }),
    }),
  },
  {
    id: "grow-lighten",
    tier: 4,
    make: () => ({
      words: "the shape gets bigger and lighter",
      start: (rng) => plain(rng, anyShape(rng), { size: 1, shading: rng.pick(["shaded", "solid"] as Shading[]) }),
      to: (f) => ({ ...f, size: 2, shading: LIGHTER[f.shading] }),
    }),
  },
  {
    id: "shrink-darken",
    tier: 4,
    make: () => ({
      words: "the shape gets smaller and darker",
      start: (rng) => plain(rng, anyShape(rng), { size: 2, shading: rng.pick(["open", "shaded"] as Shading[]) }),
      to: (f) => ({ ...f, size: 1, shading: DARKER[f.shading] }),
    }),
  },
];

/**
 * Whether some other rule explains the first pair just as well and then
 * disagrees about the second.
 *
 * A right-pointing arrow mirrored and a right-pointing arrow turned upside
 * down are the same picture, so a first pair of arrows can be read either way.
 * That costs nothing while both readings agree -- and a triangle is its own
 * mirror image but not its own upside down, so the moment the second pair is
 * a triangle the two readings give different answers and the item has two
 * defensible ones. A child who reads it the way we did not gets marked wrong
 * for reasoning correctly, which is worse than a question we never asked.
 *
 * Every rule is tried, not only the ones this tier uses: what a child can see
 * in a pair of pictures is not bounded by which level they are sitting. An
 * exam that adds rules of its own passes the wider list, for the same reason.
 */
export function ambiguous(
  rng: Rng,
  rule: Rule,
  a: Fig,
  b: Fig,
  c: Fig,
  answer: Fig,
  makers: RuleMaker[] = RULE_MAKERS,
): boolean {
  for (const maker of makers) {
    // Rules that pick something at random -- which shapes trade places, which
    // shape appears inside -- are worth more than one look.
    for (let i = 0; i < 3; i++) {
      const alt = maker.make(rng);
      if (alt.words === rule.words) break;
      if (sameLook(alt.to(a), b) && !sameLook(alt.to(c), answer)) return true;
    }
  }
  return false;
}

/** The item a failed draw falls back on, so a question always comes out. */
export const FALLBACK: Rule = {
  words: "the shape gets bigger",
  start: (rng) => plain(rng, anyShape(rng), { size: 1 }),
  to: (f) => ({ ...f, size: 2 }),
};

/* ------------------------------------------------------- what figures share */

/**
 * What a set of figures can have in common.
 *
 * The other half of the kit. A rule says what happens to a figure; a kinship
 * says what a group of them agree on -- and both exams ask about it, from
 * opposite ends. CogAT shows three that belong and asks for a fourth; the
 * NGAT shows five and asks which one does not. Same twenty kinships, same
 * check that no second reading of the group is defensible.
 */
/**
 * What three figures can have in common.
 *
 * This used to be one of four attributes -- shape, how many, how dark, how big
 * -- and below level 4 it was not even chosen: level 1 was always shape, level
 * 2 always how many, level 3 always how dark. Three tiers, three ideas, which
 * is why a session felt like the same question over and over.
 *
 * A kinship owns the figures on both sides of its rule: one that has the thing
 * in common and one that does not. Everything a member does not need is left
 * random, so the three in the group agree on the kinship and drift apart
 * everywhere else.
 */
export interface Kinship {
  /** How the shared thing reads: "they are all triangles". */
  words: string;
  member: (rng: Rng) => Fig;
  outsider: (rng: Rng) => Fig;
  /**
   * Whether a figure has the shared thing.
   *
   * `member` and `outsider` are meant to build figures that do and do not, and
   * this is what checks that they did. Without it the item rests on those two
   * agreeing, and where they disagree the failure is the worst kind: a second
   * option that belongs as well as the answer does, on the item's own rule.
   */
  holds: (f: Fig) => boolean;
}

export interface KinshipMaker {
  id: string;
  tier: 1 | 2 | 3 | 4;
  make: (rng: Rng) => Kinship;
}

export const SHADING_WORD: Record<Shading, string> = {
  open: "empty", shaded: "half shaded", solid: "filled in",
};
const HOW_MANY = { 1: "one", 2: "two", 3: "three" } as const;
const HOW_MANY4 = { 1: "one", 2: "two", 3: "three", 4: "four" } as const;

/** A figure with everything not pinned down left to chance. */
export function anyFig(rng: Rng, over: Partial<Fig> = {}): Fig {
  return {
    shape: anyShape(rng),
    shading: rng.pick(SHADINGS),
    size: rng.pick([1, 2] as const),
    count: rng.pick([1, 2, 3] as const),
    ...over,
  };
}

/** One shape, big enough to carry something: what the decorated rules build on. */
export const lone = (rng: Rng, over: Partial<Fig> = {}): Fig =>
  anyFig(rng, { size: 2, count: 1, ...over });


/**
 * A figure big enough, and wide enough at the middle, to carry something.
 *
 * Always an empty outline. A half-shaded parent is the same colour as what it
 * holds at a different strength, and two filled shapes inside one of those
 * stop being two shapes at the size these print -- which is fatal to a rule
 * about what, or how many, is in there.
 */
export const holder = (rng: Rng, over: Partial<Fig> = {}): Fig =>
  lone(rng, { shape: rng.pick(ROOMY), shading: "open", ...over });

/** One shape to sit inside a figure, or two of them -- alike or not. */
export function someShapes(rng: Rng, from: ShapeName[] = SHAPES): ShapeName[] {
  const first = rng.pick(from);
  if (rng.bool(0.45)) return [first];
  return [first, rng.bool(0.5) ? first : rng.pick(from.filter((sh) => !TWINS[first]?.includes(sh)))];
}

export const KINSHIPS: KinshipMaker[] = [
  {
    id: "shape",
    tier: 1,
    make: (rng) => {
      const shape = anyShape(rng);
      return {
        words: `they are all ${plural(shape)}`,
        holds: (f) => f.shape === shape,
        member: (r) => anyFig(r, { shape }),
        outsider: (r) => anyFig(r, { shape: r.pick(unlike(shape)) }),
      };
    },
  },
  {
    id: "count",
    tier: 1,
    make: (rng) => {
      const count = rng.pick([1, 2, 3] as const);
      return {
        words: count === 1
          ? "there is only ever one shape"
          : `there are always ${HOW_MANY[count]} of them`,
holds: (f) => !f.pair && f.count === count,
        member: (r) => anyFig(r, { count, size: 1 }),
        outsider: (r) => anyFig(r, { count: r.pick(([1, 2, 3] as const).filter((n) => n !== count)), size: 1 }),
      };
    },
  },
  {
    id: "shading",
    tier: 1,
    make: (rng) => {
      const shading = rng.pick(SHADINGS);
      return {
        words: `they are all ${SHADING_WORD[shading]}`,
        holds: (f) => f.shading === shading,
        member: (r) => anyFig(r, { shading }),
        outsider: (r) => anyFig(r, { shading: r.pick(SHADINGS.filter((sh) => sh !== shading)) }),
      };
    },
  },
  {
    id: "size",
    tier: 1,
    make: (rng) => {
      const size = rng.pick([1, 2] as const);
      return {
        words: `they are all the ${size === 1 ? "small" : "large"} size`,
        holds: (f) => !f.pair && f.size === size,
        member: (r) => anyFig(r, { size, count: r.pick([1, 2] as const) }),
        outsider: (r) => anyFig(r, { size: size === 1 ? 2 : 1, count: r.pick([1, 2] as const) }),
      };
    },
  },
  {
    id: "split",
    tier: 1,
    make: () => ({
      words: "each one is divided in half",
      holds: (f) => !!f.split,
      member: (r) => lone(r, { shape: r.pick(SPLITTABLE), shading: r.pick(["open", "solid"] as Shading[]), split: true }),
      outsider: (r) => lone(r, { shape: r.pick(SPLITTABLE), shading: r.pick(["open", "solid"] as Shading[]) }),
    }),
  },
  {
    id: "dots",
    tier: 1,
    make: (rng) => {
      const dots = rng.pick([1, 2, 3, 4] as const);
      return {
        words: `every one has ${HOW_MANY4[dots]} dot${dots === 1 ? "" : "s"} inside it`,
        holds: (f) => f.dots === dots,
        member: (r) => holder(r, { dots }),
        // Every wrong option has dots too, just not that many. An option with
        // none would be ruled out without counting anything.
        outsider: (r) => holder(r, { dots: r.pick(([1, 2, 3, 4] as const).filter((n) => n !== dots)) }),
      };
    },
  },
  {
    id: "sides",
    tier: 2,
    make: () => ({
      // Four is the only side count with enough shapes behind it to make a
      // group: three others share it, where five and six have one each.
      words: "they all have four straight sides",
      holds: (f) => SIDES[f.shape] === 4,
      member: (r) => anyFig(r, { shape: r.pick(SHAPES.filter((sh) => SIDES[sh] === 4)) }),
      outsider: (r) => anyFig(r, { shape: r.pick(SHAPES.filter((sh) => SIDES[sh] !== 4)) }),
    }),
  },
  {
    id: "round",
    tier: 2,
    make: () => ({
      words: "none of them have corners",
      holds: (f) => ROUND.includes(f.shape),
      member: (r) => anyFig(r, { shape: r.pick(ROUND) }),
      outsider: (r) => anyFig(r, { shape: r.pick(SHAPES.filter((s) => !ROUND.includes(s))) }),
    }),
  },
  {
    id: "has-inner",
    tier: 2,
    make: () => ({
      words: "each one has a smaller shape inside it",
      holds: (f) => !!f.inner,
      member: (r) => holder(r, { inner: { shapes: someShapes(r), at: "inside" } }),
      outsider: (r) => holder(r),
    }),
  },
  {
    id: "ghost",
    tier: 2,
    make: () => ({
      words: "each one has an empty copy behind it",
      holds: (f) => !!f.ghost,
      member: (r) => lone(r, { ghost: true }),
      outsider: (r) => lone(r),
    }),
  },
  {
    id: "extruded",
    tier: 2,
    make: () => ({
      words: "they are all drawn as solid blocks",
      holds: (f) => !!f.extruded,
      member: (r) => lone(r, { extruded: true }),
      outsider: (r) => lone(r),
    }),
  },
  {
    id: "inner-shape",
    tier: 3,
    make: (rng) => {
      const inner = anyShape(rng);
      return {
        words: `each one has ${article(SHAPE_WORDS[inner])} ${SHAPE_WORDS[inner]} inside it`,
        // Whatever else is in there, the named shape is: "each one has a heart
        // inside" is true of a parallelogram holding a heart and a star.
        holds: (f) => !!f.inner?.shapes.includes(inner),
        member: (r) => holder(r, {
          inner: {
            shapes: r.bool(0.5) ? [inner] : r.shuffle([inner, r.pick(unlike(inner))]),
            at: "inside",
          },
        }),
        outsider: (r) => holder(r, { inner: { shapes: someShapes(r, unlike(inner)), at: "inside" } }),
      };
    },
  },
  {
    id: "inner-pair",
    tier: 3,
    make: () => ({
      words: "each one has two different shapes inside it",
      holds: (f) => !!f.inner && new Set(f.inner.shapes).size === 2,
      member: (r) => {
        const first = anyShape(r);
        return holder(r, { inner: { shapes: [first, r.pick(unlike(first))], at: "inside" } });
      },
      // Two the same, so the contrast is the pair itself and not the fact of
      // there being something in there at all.
      outsider: (r) => {
        const first = anyShape(r);
        return holder(r, { inner: { shapes: [first, first], at: "inside" } });
      },
    }),
  },
  {
    id: "inner-matches",
    tier: 3,
    make: () => ({
      words: "each one has a smaller copy of itself inside",
      holds: (f) => f.inner?.shapes.every((sh) => sh === f.shape) ?? false,
      member: (r) => {
        const shape = r.pick(ROOMY);
        return holder(r, { shape, inner: { shapes: [shape], at: "inside" } });
      },
      outsider: (r) => {
        const shape = r.pick(ROOMY);
        return holder(r, { shape, inner: { shapes: [r.pick(unlike(shape))], at: "inside" } });
      },
    }),
  },
  {
    id: "facing",
    tier: 3,
    make: (rng) => {
      // One shape family throughout, because "the same way round" only means
      // anything between two figures that start life pointing the same way.
      const shape = rng.pick(FLIPPABLE);
      const turn = rng.pick([0, 1, 2, 3] as const);
      return {
        words: `the ${plural(shape)} are all the same way round`,
        holds: (f) => f.shape === shape && (f.turn ?? 0) === turn,
        member: (r) => anyFig(r, { shape, size: 2, count: r.pick([1, 2] as const), turn }),
        outsider: (r) => anyFig(r, {
          shape,
          size: 2,
          count: r.pick([1, 2] as const),
          turn: r.pick(([0, 1, 2, 3] as const).filter((t) => t !== turn)),
        }),
      };
    },
  },
  {
    id: "pair-order",
    tier: 3,
    make: (rng) => {
      const pair = rng.pick(["big-small", "small-big"] as const);
      return {
        words: `each one is a ${pair === "big-small" ? "large shape then a small one" : "small shape then a large one"}`,
        holds: (f) => f.pair === pair,
        member: (r) => anyFig(r, { pair }),
        outsider: (r) => anyFig(r, { pair: pair === "big-small" ? "small-big" : "big-small" }),
      };
    },
  },
  {
    id: "position",
    tier: 3,
    make: (rng) => {
      const at = rng.pick(["above", "below"] as const);
      return {
        words: `the small shape always sits ${at} the big one`,
        holds: (f) => f.inner?.at === at,
        member: (r) => holder(r, { inner: { shapes: [anyShape(r)], at } }),
        // It is still carrying something, just not there: the rule is where it
        // sits, so the wrong options have to get everything else right.
        outsider: (r) => holder(r, {
          inner: { shapes: [anyShape(r)], at: at === "above" ? r.pick(["below", "inside"] as const) : r.pick(["above", "inside"] as const) },
        }),
      };
    },
  },
  {
    id: "shape-and-shading",
    tier: 4,
    make: (rng) => {
      const shape = anyShape(rng);
      const shading = rng.pick(SHADINGS);
      return {
        words: `they are all ${plural(shape)}, and they are all ${SHADING_WORD[shading]}`,
        holds: (f) => f.shape === shape && f.shading === shading,
        member: (r) => anyFig(r, { shape, shading }),
        // Each wrong option keeps half the rule and breaks the other half, so
        // there is no way through on one attribute alone.
        outsider: (r) => r.bool(0.5)
          ? anyFig(r, { shape, shading: r.pick(SHADINGS.filter((sh) => sh !== shading)) })
          : anyFig(r, { shape: r.pick(unlike(shape)), shading }),
      };
    },
  },
  {
    id: "dots-and-size",
    tier: 4,
    make: (rng) => {
      const dots = rng.pick([2, 3] as const);
      const size = rng.pick([1, 2] as const);
      return {
        words: `every one has ${HOW_MANY4[dots]} dots inside, and they are all the ${size === 1 ? "small" : "large"} size`,
        holds: (f) => f.dots === dots && !f.pair && f.size === size,
        member: (r) => holder(r, { dots, size }),
        outsider: (r) => r.bool(0.5)
          ? holder(r, { dots: r.pick(([1, 2, 3, 4] as const).filter((n) => n !== dots)), size })
          : holder(r, { dots, size: size === 1 ? 2 : 1 }),
      };
    },
  },
  {
    id: "odd-shape",
    tier: 4,
    make: () => ({
      words: "in each one the middle shape is not like the two beside it",
      holds: (f) => f.count === 3 && !!f.odd?.shape,
      member: (r) => {
        const shape = anyShape(r);
        return anyFig(r, {
          shape,
          count: 3,
          size: 1,
          odd: { shape: r.pick(unlike(shape)) },
        });
      },
      outsider: (r) => anyFig(r, { count: 3, size: 1 }),
    }),
  },
  {
    id: "odd-facing",
    tier: 4,
    make: (rng) => {
      const shape = rng.pick(FLIPPABLE);
      return {
        words: `in each one the middle ${SHAPE_WORDS[shape]} is the other way round`,
        holds: (f) => f.count === 3 && !!f.odd?.turn,
        // Shape and count are pinned by the rule, so what is left to tell one
        // member from another is shading and size -- and four figures have to
        // come out of it, the three in the group and the one that joins them.
        member: (r) => anyFig(r, { shape, count: 3, size: r.pick([1, 2] as const), odd: { turn: 2 } }),
        outsider: (r) => anyFig(r, { shape, count: 3, size: r.pick([1, 2] as const) }),
      };
    },
  },
  {
    id: "matching-halves",
    tier: 4,
    make: () => ({
      words: "each one has two matching halves",
      holds: (f) => sameLook(f, { ...f, flip: !f.flip }),
      member: (r) => anyFig(r, { shape: r.pick(SHAPES.filter((s) => !FLIPPABLE.includes(s))) }),
      outsider: (r) => anyFig(r, { shape: r.pick(FLIPPABLE), size: 2 }),
    }),
  },
];

/**
 * The things a child might notice about a figure.
 *
 * Not the same list as the kinships: this is for checking the item, and what
 * matters there is everything a child could reasonably pick out, whether or
 * not this generator can build a group around it.
 */
export const PROPS: ((f: Fig) => string | null)[] = [
  (f) => `shape:${f.shape}`,
  (f) => `shading:${f.shading}`,
  (f) => (f.pair ? null : `size:${f.size}`),
  (f) => (f.pair ? null : `count:${f.count}`),
  (f) => `round:${ROUND.includes(f.shape)}`,
  (f) => `inner:${f.inner ? "yes" : "no"}`,
  (f) => (f.inner ? `innerShapes:${[...f.inner.shapes].sort().join("+")}` : null),
  (f) => (f.inner ? `innerCopy:${f.inner.shapes.every((sh) => sh === f.shape)}` : null),
  (f) => (f.inner ? `innerMixed:${new Set(f.inner.shapes).size > 1}` : null),
  (f) => `split:${!!f.split}`,
  (f) => `ghost:${!!f.ghost}`,
  (f) => `block:${!!f.extruded}`,
  (f) => (f.pair ? `pair:${f.pair}` : null),
  (f) => `facing:${f.turn ?? 0}${f.flip ? "m" : ""}`,
  (f) => `odd:${f.odd ? "yes" : "no"}`,
  (f) => `dots:${f.dots ?? 0}`,
  (f) => `sides:${SIDES[f.shape]}`,
  (f) => (f.inner ? `innerAt:${f.inner.at}` : null),
  (f) => `halves:${sameLook(f, { ...f, flip: !f.flip })}`,
];

/**
 * Whether every way of reading the group points at the same picture.
 *
 * The group agrees on the kinship it was built around, and on whatever else
 * fell out the same way by chance. Each of those is a rule a child might
 * settle on, and the item only holds up if none of them singles out a wrong
 * answer: a group of three solid triangles keyed on "triangle", sitting beside
 * one solid square, gives a child who reads it as "they are all filled in" a
 * defensible answer that is marked wrong.
 */
export function soundGroup(group: Fig[], options: Fig[], answer: Fig): boolean {
  for (const prop of PROPS) {
    const shared = prop(group[0]);
    if (shared === null || group.some((g) => prop(g) !== shared)) continue;
    const fits = options.filter((o) => prop(o) === shared);
    if (fits.length === 1 && fits[0] !== answer) return false;
  }
  return true;
}
