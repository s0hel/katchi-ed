import {
  ROOMY, SHADINGS, SHAPES, SHAPE_WORDS, article, opposite, sameLook,
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
