import { choice, figureChoice, str, type GeneratorFn } from "./helpers";
import { NGAT_BANKS, pool } from "./exam-banks";
import { COUNTABLE_OBJECTS, countAnalogySvg, countCardSvg, pictureCardSvg } from "./pictures";
import {
  DOT_PER_ROW_MAX, MATRIX_CELL, cutoutSvg, dotArraySvg, dotsFit, matrixSvg, numberGridSvg,
  patchSvg, type Design, type Family, type Window,
} from "./grids";
import {
  ROOMY, SHADINGS, SHAPES, SHAPE_WORDS, cellRoom, describe, figLook, figSvg, fitUnit, sameLook,
  type Fig, type ShapeName,
} from "./shapes";
import {
  DARKER, FALLBACK, LIGHTER, RULE_MAKERS, TURNABLE, TWINS, ambiguous, anyShape, plural,
  turnBy, unlike, type Rule,
} from "./figure-rules";
import type { Rng } from "../rng";

/**
 * NGAT practice, pitched at fourth grade.
 *
 * The Naglieri General Ability Tests are three separate tests -- verbal,
 * nonverbal, quantitative -- sat as whole tests rather than as batteries
 * inside one form, and each is levelled by its own grade bands: a fourth
 * grader sits the 3rd-4th form of the nonverbal and quantitative tests and the
 * 3rd-6th form of the verbal one. This file follows that split.
 *
 * What makes it a different job from `cogat.ts`, which shares most of its
 * figure kit, is the one line in the test's own description that decides
 * everything else: **the only text on the page is numerals.** The instructions
 * are animated and wordless so that they need no translation, the verbal test
 * is pictures rather than words, and the quantitative test is patterns rather
 * than word problems. So nothing here is read aloud and nothing here is a
 * sentence about a figure -- where CogAT's Level 7 avoids text because a
 * six-year-old cannot read, the NGAT avoids it at every age because reading is
 * the thing it is trying not to measure.
 *
 * Two consequences run through the file. Numerals are allowed, and used: a
 * fourth grader can reason about 3, 8, 13 without it becoming a reading test,
 * and pretending otherwise would make the quantitative items easier than the
 * real ones. And the nonverbal items are matrices with no arrows -- CogAT
 * draws an arrow to say which way the rule runs, and finding that for yourself
 * is part of what the NGAT is measuring.
 *
 * As with CogAT: this does not make a child brighter, and is not built on the
 * premise that it does. It removes the part of a low score that is only
 * unfamiliarity.
 */

/**
 * How many options an NGAT item offers.
 *
 * Five for the nonverbal and quantitative tests, which is what the published
 * samples show. Six for the verbal one, and that is not a choice either: the
 * item shows six pictures and asks which of them does not belong, so the
 * options *are* the question and their number is fixed by the format.
 */
const OPTIONS = 5;
const VERBAL_OPTIONS = 6;

/* ----------------------------------------------------------------- verbal */

/**
 * The Naglieri verbal test: six pictures, five with something in common.
 *
 * Nothing is given as a worked example. CogAT's classification shows three
 * that belong and asks for a fourth, which tells the child the category exists
 * before they start looking for it; here the group and the outsider arrive
 * together and finding the idea is the item. The pictures carry no words, for
 * the same reason the real test's do not.
 *
 * `kind` splits the bank into two skills -- what five pictures *are* against
 * what they *do or have*. The test does not label them; we do, because a child
 * who can see that five things are insects may still not see that five things
 * give off their own light, and a single skill would ramp from one to the
 * other invisibly.
 */
const oddOneOut: GeneratorFn = (rng, level, params) => {
  const kind = str(params, "kind", "category");
  const item = rng.pick(pool(NGAT_BANKS.oddOneOut.filter((i) => i.kind === kind), level));
  return figureChoice(rng, {
    instructions: "Five of these six pictures are alike in one way.",
    stem: "Which picture does **not** belong with the others?",
    answerFigure: pictureCardSvg(item.odd),
    distractorFigures: item.group.map(pictureCardSvg),
    options: VERBAL_OPTIONS,
    explanation: `Five of them are alike: ${item.concept}. ${item.why}`,
    hint:
      kind === "category"
        ? "Name each picture out loud. What kind of thing are most of them?"
        : "Do not ask what they are — ask what they do, or what each one has.",
  });
};

/* -------------------------------------------------------------- nonverbal */

/** A figure with everything not pinned down left to chance. */
function anyFig(rng: Rng, over: Partial<Fig> = {}): Fig {
  return {
    shape: anyShape(rng),
    shading: rng.pick(SHADINGS),
    size: rng.pick([1, 2] as const),
    count: rng.pick([1, 2, 3] as const),
    ...over,
  };
}

/**
 * Whether a figure shows everything it claims to hold.
 *
 * A dot or an inner shape is drawn in the stroke colour, so inside a filled
 * outline it is on the page and not on the paper -- and `figLook` compares
 * what is drawn rather than what shows, so it would happily let two options
 * through as different when both are a black pentagon.
 */
const readable = (f: Fig): boolean => !((f.inner || f.dots) && f.shading === "solid");

/** Three shapes no two of which could be mistaken for each other. */
function threeShapes(rng: Rng): ShapeName[] {
  const out: ShapeName[] = [];
  for (const s of rng.shuffle([...SHAPES])) {
    if (out.every((o) => o !== s && !(TWINS[o] ?? []).includes(s))) out.push(s);
    if (out.length === 3) break;
  }
  return out;
}

/* ------------------------------------------------- matrices: one rule */

/**
 * A two-by-two matrix: the rule shown in the top row, applied to the bottom.
 *
 * The same driver as CogAT's figure analogies, over the same rules, drawn
 * without the arrow. The checks are what make it an item rather than a
 * picture: the rule has to visibly change the top row, visibly change the
 * bottom, land the bottom somewhere the top did not -- otherwise "copy the box
 * above" answers it -- and no other rule may explain the top row and then
 * disagree about the bottom.
 */
function analogyMatrix(rng: Rng, level: number): ReturnType<GeneratorFn> {
  // A fourth grader starts where CogAT's top tiers leave off, so level 1 here
  // already draws on rules that are level 3 material for a six-year-old.
  const makers = RULE_MAKERS.filter((m) => m.tier <= level + 2);

  let rule: Rule = FALLBACK;
  let a = rule.start(rng);
  let b = rule.to(a);
  let c = { ...a, shape: rng.pick(unlike(a.shape)) };
  let answer = rule.to(c);

  outer: for (let pick = 0; pick < 14; pick++) {
    const maker = rng.pick(makers);
    const still = maker.id === "same";
    for (let draw = 0; draw < 6; draw++) {
      const r = maker.make(rng);
      const x = r.start(rng);
      const y = r.to(x);
      if (!still && sameLook(x, y)) continue;
      const z = r.start(rng);
      if (sameLook(z, x) || (!still && sameLook(z, r.to(z))) || sameLook(r.to(z), y)) continue;
      if (ambiguous(rng, r, x, y, z, r.to(z))) continue;
      rule = r;
      [a, b, c, answer] = [x, y, z, r.to(z)];
      break outer;
    }
  }

  const seen = new Set([figLook(answer)]);
  const wrong: Fig[] = [];
  const offer = (f: Fig) => {
    const k = figLook(f);
    if (wrong.length >= 6 || seen.has(k) || !readable(f)) return;
    seen.add(k);
    wrong.push(f);
  };

  offer(c); // the rule was never applied
  offer(b); // the answer was copied from the row above
  offer(rule.to(answer)); // the rule was applied twice
  for (const m of rng.shuffle([...makers])) offer(m.make(rng).to(c));
  offer({ ...answer, shading: DARKER[answer.shading] });
  offer({ ...answer, shading: LIGHTER[answer.shading] });
  offer({ ...answer, shape: rng.pick(unlike(answer.shape)) });
  offer({ ...answer, size: answer.size === 1 ? 2 : 1 });
  offer(turnBy(answer, 1));

  const unit = fitUnit([a, b, c, answer, ...wrong], cellRoom(MATRIX_CELL));
  return figureChoice(rng, {
    instructions: "Work out what changes from the first box to the second, all the way across.",
    stem: "Which figure belongs where the **?** is?",
    figure: matrixSvg([[a, b], [c, null]], unit),
    options: OPTIONS,
    answerFigure: figSvg(answer, unit, MATRIX_CELL),
    distractorFigures: wrong.map((f) => figSvg(f, unit, MATRIX_CELL)),
    explanation: `Across each row, ${rule.words}: ${describe(a)} becomes ${describe(b)}. Doing the same to ${describe(c)} gives ${describe(answer)}.`,
    hint: "Read the top row first and say the change out loud. Then say it again about the bottom row.",
  });
}

/* --------------------------------------- matrices: an attribute in three */

/**
 * An attribute with three ordered states, for a grid that steps through them.
 *
 * A rule transforms a figure once; a series has to keep going, three cells
 * across and three down, and come back somewhere sensible. That rules out most
 * of the transformations in `figure-rules.ts` -- a shape cannot get bigger
 * three times -- so the series are their own small set, each one an attribute
 * that genuinely has three states to visit.
 *
 * `field` is the one attribute a series writes. Two series sharing a grid must
 * write different fields, or the second silently overwrites the first and the
 * row it was supposed to explain does nothing.
 */
interface Series {
  field: string;
  /** how the change reads: "each one is darker than the one before" */
  words: string;
  /** narrow a figure to one this series can step through */
  fit: (rng: Rng, f: Fig) => Fig;
  at: (f: Fig, step: number) => Fig;
}

interface SeriesMaker {
  id: string;
  tier: 1 | 2 | 3 | 4;
  make: (rng: Rng) => Series;
}

const SERIES_MAKERS: SeriesMaker[] = [
  {
    id: "shading",
    tier: 1,
    make: () => ({
      field: "shading",
      words: "each figure is darker than the one before",
      fit: (_r, f) => f,
      at: (f, i) => ({ ...f, shading: SHADINGS[i] }),
    }),
  },
  {
    id: "count",
    tier: 1,
    make: () => ({
      field: "count",
      words: "one more shape is added each time",
      fit: (_r, f) => ({ ...f, size: 1, pair: undefined, odd: null }),
      at: (f, i) => ({ ...f, count: (i + 1) as 1 | 2 | 3 }),
    }),
  },
  {
    id: "shape",
    tier: 1,
    make: (rng) => {
      const three = threeShapes(rng);
      return {
        field: "shape",
        words: `the shapes go ${three.map((s) => plural(s)).join(", then ")}`,
        fit: (_r, f) => f,
        at: (f, i) => ({ ...f, shape: three[i] }),
      };
    },
  },
  {
    id: "turn",
    tier: 2,
    make: () => ({
      field: "turn",
      words: "each figure is turned a quarter turn clockwise from the one before",
      fit: (r, f) => ({ ...f, shape: r.pick(TURNABLE), size: 2, count: 1, odd: null }),
      at: (f, i) => turnBy({ ...f, turn: 0 }, i),
    }),
  },
  {
    id: "dots",
    tier: 2,
    make: () => ({
      field: "dots",
      words: "one more dot appears inside each time",
      fit: (r, f) => ({
        ...f, shape: r.pick(ROOMY), shading: r.pick(["open", "shaded"] as const),
        size: 2, count: 1, inner: null,
      }),
      at: (f, i) => ({ ...f, dots: (i + 1) as 1 | 2 | 3 }),
    }),
  },
  {
    id: "inner",
    tier: 3,
    make: (rng) => {
      const three = threeShapes(rng);
      return {
        field: "inner",
        words: `the shape inside goes ${three.map((s) => SHAPE_WORDS[s]).join(", then ")}`,
        fit: (r, f) => ({
          ...f, shape: r.pick(ROOMY), shading: "open", size: 2, count: 1, dots: undefined,
        }),
        at: (f, i) => ({ ...f, inner: { shapes: [three[i]], at: "inside" } }),
      };
    },
  },
];

/** A grid stepped by one series across and another down, or null if it failed. */
interface Grid {
  cells: Fig[][];
  across: Series;
  down: Series;
  /** the figure both series were stepped from, and every cell's near miss */
  base: Fig;
}

/**
 * Two series over one figure, one running across and one running down.
 *
 * Built and then checked by what it draws. Two series that write different
 * fields still need not produce nine different pictures: a series that turns a
 * shape shows nothing once another series has replaced that shape with a
 * circle, and a series that puts a shape inside shows nothing once another has
 * filled the outline in. So the grid is only accepted if all nine cells are
 * different pictures and every one of them shows what it holds.
 */
function buildGrid(rng: Rng, makers: SeriesMaker[]): Grid | null {
  for (let attempt = 0; attempt < 24; attempt++) {
    const [ma, mb] = rng.sample(makers, 2);
    if (!ma || !mb) return null;
    const across = ma.make(rng);
    const down = mb.make(rng);
    if (across.field === down.field) continue;

    const base = down.fit(rng, across.fit(rng, anyFig(rng)));
    const cells = [0, 1, 2].map((r) => [0, 1, 2].map((c) => down.at(across.at(base, c), r)));
    const flat = cells.flat();
    if (!flat.every(readable)) continue;
    if (new Set(flat.map(figLook)).size !== 9) continue;
    return { cells, across, down, base };
  }
  return null;
}

/**
 * The three-by-three matrix: one change along the rows, another down the
 * columns, and one cell left out.
 */
function progressionMatrix(rng: Rng, level: number): ReturnType<GeneratorFn> {
  const makers = SERIES_MAKERS.filter((m) => m.tier <= level);
  const grid = buildGrid(rng, makers) ?? buildGrid(rng, SERIES_MAKERS.filter((m) => m.tier <= 2));
  // Nothing drew: fall back to the two-by-two, which cannot fail.
  if (!grid) return analogyMatrix(rng, level);

  const { cells, across, down, base } = grid;
  // The bottom right is the cell a reader reaches last. Level 4 moves it, so
  // the grid has to be read in both directions rather than just continued.
  const [mr, mc] = level >= 4 ? [rng.int(0, 2), rng.int(0, 2)] : [2, 2];
  const answer = cells[mr][mc];

  const seen = new Set([figLook(answer)]);
  const wrong: Fig[] = [];
  const offer = (f: Fig) => {
    const k = figLook(f);
    if (wrong.length >= 6 || seen.has(k) || !readable(f)) return;
    seen.add(k);
    wrong.push(f);
  };
  // The cells either side and above and below: the mistake of copying a
  // neighbour, which is also the mistake of stepping the wrong series.
  for (const step of [1, 2]) {
    offer(down.at(across.at(base, (mc + step) % 3), mr));
    offer(down.at(across.at(base, mc), (mr + step) % 3));
  }
  offer(down.at(across.at(base, (mc + 1) % 3), (mr + 1) % 3));
  offer(base);

  const shown: (Fig | null)[][] = cells.map((row, r) =>
    row.map((f, c) => (r === mr && c === mc ? null : f)),
  );
  const unit = fitUnit([...cells.flat(), ...wrong], cellRoom(MATRIX_CELL));

  return figureChoice(rng, {
    instructions: "One thing changes along each row, and a different thing changes down each column.",
    stem: "Which figure belongs where the **?** is?",
    figure: matrixSvg(shown, unit),
    options: OPTIONS,
    answerFigure: figSvg(answer, unit, MATRIX_CELL),
    distractorFigures: wrong.map((f) => figSvg(f, unit, MATRIX_CELL)),
    explanation: `Across each row, ${across.words}. Down each column, ${down.words}. Where the two meet, the figure is ${describe(answer)}.`,
    hint: "Read one row across, then read one column down. The missing figure has to obey both.",
  });
}

/** Figure matrices: a pair of boxes at the bottom, a filled grid at the top. */
const figureMatrices: GeneratorFn = (rng, level) =>
  level <= 2 ? analogyMatrix(rng, level) : progressionMatrix(rng, level);

/* ------------------------------------------------------- serial reasoning */

/**
 * Figures that differ from `f` in something the series does not own.
 *
 * A series has three states, so a grid built on one offers only two wrong
 * answers -- and an item needs four. These make up the rest: the right state
 * of the series with something else about it changed, which is the option a
 * child takes when they have found the pattern and stopped checking.
 */
function nearMissFigs(rng: Rng, f: Fig, owned: string[]): Fig[] {
  const out: Fig[] = [];
  const offer = (g: Fig) => {
    if (readable(g) && !sameLook(g, f) && !out.some((o) => sameLook(o, g))) out.push(g);
  };
  if (!owned.includes("shape")) offer({ ...f, shape: rng.pick(unlike(f.shape)) });
  if (!owned.includes("shading")) {
    offer({ ...f, shading: DARKER[f.shading] });
    offer({ ...f, shading: LIGHTER[f.shading] });
  }
  if (!owned.includes("count") && !f.pair) {
    offer({ ...f, count: (f.count === 3 ? 1 : f.count + 1) as 1 | 2 | 3, size: 1 });
  }
  if (!owned.includes("turn")) offer(turnBy(f, 2));
  if (!owned.includes("dots") && !f.inner) offer({ ...f, dots: f.dots === 4 ? 1 : ((f.dots ?? 0) + 1) as 1 | 2 | 3 | 4 });
  return out;
}

/**
 * Serial reasoning: the same three figures, once in every row and once in
 * every column.
 *
 * At the bottom two levels it is a plain sequence read the way a page is read
 * -- two rows of three, the cycle starting again on the second row -- which is
 * the form the published sample shows. Above that it is the square the test is
 * known for: three states arranged so that no row and no column repeats one,
 * which cannot be answered by continuing left to right.
 */
const serialReasoning: GeneratorFn = (rng, level) => {
  const makers = SERIES_MAKERS.filter((m) => m.tier <= Math.max(2, level));
  let series: Series | null = null;
  let states: Fig[] = [];
  for (let attempt = 0; attempt < 24 && !series; attempt++) {
    const maker = rng.pick(makers);
    const candidate = maker.make(rng);
    const base = candidate.fit(rng, anyFig(rng));
    const drawn = [0, 1, 2].map((i) => candidate.at(base, i));
    if (!drawn.every(readable)) continue;
    if (new Set(drawn.map(figLook)).size !== 3) continue;
    series = candidate;
    states = drawn;
  }
  if (!series) return analogyMatrix(rng, level);

  // Which state sits in each cell. Reading order at the bottom two levels; a
  // Latin square -- every state once per row and once per column -- above.
  const shift = rng.pick([1, 2]);
  const offset = rng.int(0, 2);
  const rows = level <= 2 ? 2 : 3;
  const at = (r: number, c: number) =>
    level <= 2 ? (r * 3 + c + offset) % 3 : (r * shift + c + offset) % 3;

  const [mr, mc] = level <= 2 ? [rows - 1, 2] : [rng.int(0, rows - 1), rng.int(0, 2)];
  const answer = states[at(mr, mc)];

  const seen = new Set([figLook(answer)]);
  const wrong: Fig[] = [];
  const offer = (f: Fig) => {
    const k = figLook(f);
    if (wrong.length >= 6 || seen.has(k) || !readable(f)) return;
    seen.add(k);
    wrong.push(f);
  };
  // The two states that belong elsewhere in this row, then figures that have
  // the right state and something else wrong.
  for (const s of states) offer(s);
  for (const f of nearMissFigs(rng, answer, [series.field])) offer(f);

  const cells: (Fig | null)[][] = Array.from({ length: rows }, (_, r) =>
    [0, 1, 2].map((c) => (r === mr && c === mc ? null : states[at(r, c)])),
  );
  const unit = fitUnit([...states, ...wrong], cellRoom(MATRIX_CELL));

  return figureChoice(rng, {
    instructions:
      level <= 2
        ? "The same few figures keep coming round, in order."
        : "Every row has each figure once, and so does every column.",
    stem: "Which figure belongs where the **?** is?",
    figure: matrixSvg(cells, unit),
    options: OPTIONS,
    answerFigure: figSvg(answer, unit, MATRIX_CELL),
    distractorFigures: wrong.map((f) => figSvg(f, unit, MATRIX_CELL)),
    explanation:
      level <= 2
        ? `Read the boxes the way you read a page. Three figures keep repeating, and ${series.words}. The next one round is ${describe(answer)}.`
        : `Three figures appear once in every row and once in every column, and ${series.words}. That row and that column both still need ${describe(answer)}.`,
    hint:
      level <= 2
        ? "Say the figures out loud in order, and keep going past the end of the first row."
        : "Cover everything but the row with the ? in it. Which of the three is missing from it?",
  });
};

/* --------------------------------------------------- spatial visualization */

/** Mirrored left for right -- the one change a turn can never make. */
const mirrored = (f: Fig): Fig => ({ ...f, flip: !f.flip });

const turns = (f: Fig): Fig[] => [0, 1, 2, 3].map((q) => turnBy(f, q));

/**
 * A figure that a mirror moves and no amount of turning can undo.
 *
 * The item asks which option is the figure turned rather than flipped over, so
 * it only exists if the figure has a handedness at all: a star or a hexagon is
 * its own mirror image, and every option would then be right. Handedness comes
 * from a shape with no axis of symmetry, or from something added off to one
 * side -- a copy behind it, a solid block, a half cut off, two different
 * shapes inside.
 */
function chiralFig(rng: Rng, level: number): Fig {
  const dress: ((rng: Rng, f: Fig) => Fig)[] = [
    (_r, f) => ({ ...f, shape: _r.pick(["arrow", "ell", "parallelogram"] as ShapeName[]) }),
    (_r, f) => ({ ...f, ghost: true }),
    (_r, f) => ({ ...f, extruded: true }),
    (_r, f) => ({ ...f, split: true, shading: "open" }),
    (_r, f) => {
      const [a, b] = threeShapes(_r);
      return { ...f, shape: _r.pick(ROOMY), shading: "open", inner: { shapes: [a, b], at: "inside" } };
    },
  ];
  // More than one dressing at the top levels, so the figure carries more to
  // keep track of while it is being turned.
  const layers = level <= 1 ? 1 : level <= 3 ? rng.int(1, 2) : 2;

  for (let attempt = 0; attempt < 30; attempt++) {
    let f = anyFig(rng, { size: 2, count: 1 });
    for (const step of rng.sample(dress, layers)) f = step(rng, f);
    if (!readable(f)) continue;
    // Every way of turning it has to stay clear of every way of turning its
    // mirror image, or one of the wrong options is also right.
    const mine = turns(f).map(figLook);
    const theirs = turns(mirrored(f)).map(figLook);
    if (mine.some((k) => theirs.includes(k))) continue;
    if (new Set(theirs).size < 4) continue;
    return f;
  }
  return { shape: "ell", shading: "open", size: 2, count: 1 };
}

/**
 * Spatial visualization: the same figure, turned -- never flipped over.
 *
 * Four of the five options are the figure's mirror image at four different
 * angles, and the fifth is the figure itself at one. Telling those apart is
 * the whole of the task, and it is the one nonverbal question here that cannot
 * be answered by naming what changed: a mirror image and a turn look like the
 * same kind of change until you try to make one out of the other.
 */
const spatialVisualization: GeneratorFn = (rng, level) => {
  const f = chiralFig(rng, level);
  const quarter = rng.pick([1, 2, 3]);
  const answer = turnBy(f, quarter);
  const wrong = rng.shuffle(turns(mirrored(f))).slice(0, 4);

  const unit = fitUnit([f, answer, ...wrong], cellRoom(MATRIX_CELL));
  return figureChoice(rng, {
    instructions: "Turn this figure in your head. It is never flipped over.",
    stem: "Which one is the **same figure, turned**?",
    figure: matrixSvg([[f]], unit),
    options: OPTIONS,
    answerFigure: figSvg(answer, unit, MATRIX_CELL),
    distractorFigures: wrong.map((g) => figSvg(g, unit, MATRIX_CELL)),
    explanation: `Turning ${describe(f)} gives ${describe(answer)}. Every other option is its mirror image — turn one of those any way you like and it never matches.`,
    hint: "Pick one part of the figure and follow it round. If it ends up on the wrong side, that option is a mirror image.",
  });
};

/* ------------------------------------------------------ pattern completion */

const ANGLES: Family["angle"][] = [0, 90, 45, 135];
/** Wide enough to count, close enough that every window shows at least one. */
const SPACINGS = [26, 32, 38, 44];

function makeFamilies(rng: Rng, level: number): Family[] {
  const angles: Family["angle"][] = rng.shuffle(level <= 1 ? [0, 90] : [...ANGLES]);
  const howMany = level <= 2 ? 1 : 2;
  return angles.slice(0, howMany).map((angle, i) => {
    const spacing = rng.pick(SPACINGS);
    return {
      angle,
      spacing,
      phase: rng.int(0, spacing - 1),
      dashed: level >= 4 && i === 1,
    };
  });
}

/**
 * Pattern completion: a square of ruled lines with one piece cut out.
 *
 * The right patch is the design seen through the hole -- literally, by
 * cropping the same drawing -- so it cannot disagree with the pattern around
 * it. Every wrong patch is the same renderer with one number moved: a family
 * shifted half a gap, spaced differently, turned to another angle, dropped
 * altogether. That is the point of describing the design as numbers rather
 * than drawing it: a child rules an option out because its lines do not meet
 * the ones around the hole, not because it was drawn worse.
 */
/** How a family of lines runs, for the explanation. */
const SLANT: Record<Family["angle"], string> = {
  0: "straight up and down",
  90: "straight across",
  45: "slanting up to the right",
  135: "slanting down to the right",
};

const patternCompletion: GeneratorFn = (rng, level) => {
  const families = makeFamilies(rng, level);
  const design: Design = { families };
  const where: Window = { col: rng.int(0, 2), row: rng.int(0, 2) };

  const spoil: Design[] = [];
  families.forEach((f, i) => {
    const swap = (over: Partial<Family>): Design => ({
      families: families.map((g, j) => (j === i ? { ...g, ...over } : g)),
    });
    spoil.push(swap({ phase: f.phase + Math.round(f.spacing / 2) }));
    spoil.push(swap({ spacing: f.spacing === SPACINGS[0] ? SPACINGS[2] : SPACINGS[0] }));
    for (const angle of ANGLES) if (angle !== f.angle) spoil.push(swap({ angle }));
    spoil.push(swap({ dashed: !f.dashed }));
    if (families.length > 1) spoil.push({ families: families.filter((_, j) => j !== i) });
  });

  return figureChoice(rng, {
    instructions: "A square piece has been cut out of this pattern.",
    stem: "Which piece fills the hole?",
    figure: cutoutSvg(design, where),
    options: OPTIONS,
    answerFigure: patchSvg(design, where),
    // Two spoiled designs can look the same through one small window;
    // `figureChoice` keeps the first of each and drops the repeats.
    distractorFigures: rng.shuffle(spoil).map((d) => patchSvg(d, where)),
    explanation:
      families.length === 1
        ? `The pattern is one set of evenly spaced lines running ${SLANT[families[0].angle]}. The piece that fits carries them straight on, at the same slant and the same distance apart.`
        : `The pattern is two sets of lines crossing: one ${SLANT[families[0].angle]} and one ${SLANT[families[1].angle]}. A piece only fits if both sets run straight on through it — same slant, same spacing, drawn the same way.`,
    hint: "Look at the edges of the hole. Follow each line into it and see where it would come out.",
  });
};

/* ----------------------------------------------------------- quantitative */

/** Wrong numbers near a right one, never below zero. */
function nearbyNumbers(rng: Rng, answer: number, spread: number, count: number): number[] {
  const out: number[] = [];
  const offer = (n: number) => {
    if (n >= 0 && n !== answer && !out.includes(n) && out.length < count) out.push(n);
  };
  for (let i = 0; i < 20 && out.length < count; i++) offer(answer + rng.intExcept(-spread, spread, [0]));
  for (let d = 1; out.length < count && d <= spread + count; d++) {
    offer(answer + d);
    offer(answer - d);
  }
  return out;
}

/**
 * A run of numbers, and the rule behind it.
 *
 * `words` is a whole sentence rather than a phrase slotted after "the rule is
 * to", because half of these rules do not fit that frame -- a run whose gaps
 * widen has no single step to name, and one that cycles has no step at all.
 */
interface Run {
  terms: number[];
  words: string;
  /** roughly how far apart the terms are, for choosing wrong answers */
  spread: number;
}

function makeRun(rng: Rng, level: number): Run {
  const kinds =
    level <= 1
      ? ["add"]
      : level === 2
        ? ["add", "subtract"]
        : level === 3
          ? ["add", "subtract", "multiply", "growing"]
          : ["subtract", "multiply", "growing", "alternate", "repeat"];

  switch (rng.pick(kinds)) {
    case "subtract": {
      const d = rng.int(2, level >= 3 ? 12 : 9);
      const start = rng.int(d * 5 + 1, d * 5 + 40);
      return { terms: run(6, start, (t) => t - d), words: `Take ${d} away each time`, spread: d };
    }
    case "multiply": {
      const k = rng.pick([2, 3]);
      const start = rng.int(1, k === 2 ? 5 : 3);
      return { terms: run(5, start, (t) => t * k), words: k === 2 ? "Double each time" : `Multiply by ${k} each time`, spread: start * k * 2 };
    }
    case "growing": {
      const first = rng.int(1, 6);
      const grow = rng.int(1, level >= 4 ? 4 : 2);
      let gap = first;
      const start = rng.int(1, 12);
      const terms = run(6, start, (t) => {
        const next = t + gap;
        gap += grow;
        return next;
      });
      const gaps = terms.slice(1).map((t, i) => t - terms[i]);
      return { terms, words: `The gaps grow each time — ${gaps.join(", ")}`, spread: gaps[gaps.length - 1] };
    }
    case "alternate": {
      const up = rng.int(5, 14);
      const down = rng.intExcept(2, 10, [up]);
      const start = rng.int(down + 1, 40);
      let i = 0;
      const terms = run(6, start, (t) => t + (i++ % 2 === 0 ? up : -down));
      return { terms, words: `Add ${up}, then take ${down} away, over and over`, spread: up };
    }
    case "repeat": {
      const cycle = rng.sample([rng.int(2, 9), rng.int(10, 29), rng.int(30, 60)], rng.pick([2, 3]));
      const terms = Array.from({ length: 6 }, (_, i) => cycle[i % cycle.length]);
      return { terms, words: `The same ${cycle.length} numbers keep coming round`, spread: 12 };
    }
    default: {
      const d = rng.int(2, level >= 2 ? 12 : 9);
      const start = rng.int(1, 20);
      return { terms: run(6, start, (t) => t + d), words: `Add ${d} each time`, spread: d };
    }
  }
}

const run = (n: number, start: number, next: (t: number) => number): number[] => {
  const out = [start];
  for (let i = 1; i < n; i++) out.push(next(out[i - 1]));
  return out;
};

/**
 * Number series: a row of numerals with one of them missing.
 *
 * Numerals, not pictures. They are the only thing the NGAT asks a reader to
 * read, and by fourth grade writing `3, 8, 13` instead of drawing three, then
 * eight, then thirteen of something is not what makes the item hard -- while
 * drawing them would cap the series at what fits in a box.
 */
const numberSeries: GeneratorFn = (rng, level) => {
  let { terms, words, spread } = makeRun(rng, level);
  // A fourth grader has not met negative numbers, so a run that dips below
  // zero is not a harder item -- it is one asking something it never taught.
  if (terms.some((t) => t < 0)) ({ terms, words, spread } = makeRun(rng, 1));
  // Above the bottom tiers the blank can fall inside the run, so it has to be
  // read from both sides rather than simply continued.
  const blank = level <= 2 ? terms.length - 1 : rng.int(2, terms.length - 1);
  const answer = terms[blank];
  const shown: (number | null)[] = terms.map((t, i) => (i === blank ? null : t));

  // A wrong option that is already printed in the run is one a reader can
  // strike out without working anything out, which in a five-option item is a
  // whole option given away. A repeated value is fine in the run itself.
  const onThePage = new Set(shown.filter((t): t is number => t !== null));
  const wrong = nearbyNumbers(rng, answer, Math.max(2, Math.round(spread)), 8)
    .filter((n) => !onThePage.has(n))
    .slice(0, 4);

  return choice(rng, {
    instructions: "These numbers follow one rule all the way along.",
    stem: "Which number belongs where the **?** is?",
    figure: numberGridSvg([shown]),
    answer: `${answer}`,
    options: OPTIONS,
    distractors: wrong.map(String),
    explanation: `${words}: ${terms.join(", ")}. So the missing number is ${answer}.`,
    hint: "Work out the gap between the first two numbers, then check it against the next pair.",
  });
};

/**
 * Number analogies: a set of objects becomes another, so what does this one
 * become?
 *
 * The published sample is exactly this -- two gifts become three, so one pair
 * of scissors becomes how many -- and it is the one quantitative item the test
 * draws rather than writes, because the rule is about how many and not about
 * which. The rows deliberately use different objects, so matching on the
 * object rather than the count gets it wrong.
 *
 * Fourth grade is where this stops being addition: the top tiers double and
 * treble, which is why the boxes here hold up to nine where CogAT's hold six.
 */
const numberAnalogies: GeneratorFn = (rng, level) => {
  const MAX_SET = 9;
  interface Change {
    to: (n: number) => number;
    words: string;
    from: number[];
  }
  const all: Change[] = [
    ...[1, 2, 3, 4].map((d) => ({ to: (n: number) => n + d, words: `${d} more`, from: range(1, MAX_SET - d) })),
    ...[1, 2, 3].map((d) => ({ to: (n: number) => n - d, words: `${d} fewer`, from: range(d + 1, MAX_SET) })),
    ...[2, 3, 4].map((k) => ({ to: (n: number) => n * k, words: `${k} times as many`, from: range(1, Math.floor(MAX_SET / k)) })),
    { to: (n: number) => n / 2, words: "half as many", from: [2, 4, 6, 8] },
    { to: (n: number) => n / 3, words: "a third as many", from: [3, 6, 9] },
  ];
  const changes =
    level <= 1
      ? all.filter((c) => c.words.endsWith("more"))
      : level === 2
        ? all.filter((c) => /more|fewer/.test(c.words))
        : level === 3
          ? all.filter((c) => !/third|4 times/.test(c.words))
          : all;

  // A change needs two starting counts: one for the worked row and a different
  // one for the row being asked about, so the rule cannot be read as "copy the
  // box above".
  const change = rng.pick(changes.filter((c) => c.from.length >= 2));
  const [topFrom, bottomFrom] = rng.sample(change.from, 2);
  const answer = change.to(bottomFrom);
  const [topPicture, bottomPicture] = rng.sample(COUNTABLE_OBJECTS, 2);

  const seen = new Set([answer]);
  const wrong: string[] = [];
  const offer = (n: number) => {
    if (!Number.isInteger(n) || n < 1 || n > MAX_SET || seen.has(n) || wrong.length >= 4) return;
    seen.add(n);
    wrong.push(countCardSvg(bottomPicture, n));
  };
  // Nearest first: the count that did not change, the rule the other way, the
  // rule applied to the wrong row, then either side.
  offer(bottomFrom);
  offer(bottomFrom + (bottomFrom - answer));
  offer(change.to(topFrom));
  offer(answer + 1);
  offer(answer - 1);
  for (let d = 2; wrong.length < 4 && d <= MAX_SET; d++) {
    offer(answer + d);
    offer(answer - d);
  }

  return figureChoice(rng, {
    instructions: "Work out what happens in the top row, then do the same in the bottom row.",
    stem: "How many belong in the empty box?",
    figure: countAnalogySvg(
      { picture: topPicture, from: topFrom, to: change.to(topFrom) },
      { picture: bottomPicture, from: bottomFrom },
    ),
    answerFigure: countCardSvg(bottomPicture, answer),
    distractorFigures: wrong,
    options: OPTIONS,
    explanation: `The top row goes from ${topFrom} to ${change.to(topFrom)} — ${change.words}. Doing the same to ${bottomFrom} gives ${answer}.`,
    hint: "Count both boxes in the top row. Did the number go up by something, or times by something?",
  });
};

const range = (lo: number, hi: number): number[] =>
  hi < lo ? [] : Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

/**
 * Number matrices: a grid of numerals where the rows and the columns each
 * follow a rule.
 *
 * The same reasoning as the figure matrix a test earlier, with numbers in the
 * boxes -- which is what the quantitative test's own description promises:
 * numbers and shapes arranged in a pattern, and never a word problem.
 */
const numberMatrices: GeneratorFn = (rng, level) => {
  const size = level <= 2 ? 2 : 3;
  const dc = rng.int(2, level >= 3 ? 15 : 9);
  const dr = rng.intExcept(2, level >= 3 ? 20 : 12, [dc]);
  const base = rng.int(1, 20);
  // At the top level the rows multiply rather than add, so the two directions
  // are not the same kind of step.
  const times = level >= 4 ? rng.pick([2, 3]) : 1;

  const cell = (r: number, c: number) => (base + r * dr) * times ** c + (times === 1 ? c * dc : 0);
  const grid = range(0, size - 1).map((r) => range(0, size - 1).map((c) => cell(r, c)));

  const [mr, mc] = level >= 4 ? [rng.int(0, size - 1), rng.int(0, size - 1)] : [size - 1, size - 1];
  const answer = grid[mr][mc];
  const shown: (number | null)[][] = grid.map((row, r) =>
    row.map((n, c) => (r === mr && c === mc ? null : n)),
  );

  // What the grid does, said the way it is actually true. When the rows
  // multiply, the columns no longer step by a single number -- each one steps
  // by `dr` times its own power -- so the honest description is the row starts
  // and the row rule, not two step sizes that only one of the columns obeys.
  const rule =
    times === 1
      ? `Along each row you add ${dc} as you go right, and down each column you add ${dr}`
      : `Each row multiplies by ${times} as you go right, and the rows begin ${grid.map((row) => row[0]).join(", ")} — ${dr} more each time`;
  const distractors = [
    cell(mr, (mc + 1) % size),
    cell((mr + 1) % size, mc),
    ...nearbyNumbers(rng, answer, Math.max(2, times === 1 ? Math.min(dr, dc) : dr), 4),
  ];

  return choice(rng, {
    instructions: "The rows follow one rule and the columns follow another.",
    stem: "Which number belongs where the **?** is?",
    figure: numberGridSvg(shown),
    answer: `${answer}`,
    options: OPTIONS,
    distractors: distractors.filter((n) => n >= 0 && n !== answer).map(String),
    explanation: `${rule}. Where that row and that column meet, the number is ${answer}.`,
    hint: "Finish a row you can see all of. Then do the same to the row with the ? in it.",
  });
};

/** The row widths a total can be laid out in, inside one cell. */
const layoutsFor = (total: number): number[] =>
  range(1, Math.min(DOT_PER_ROW_MAX, total)).filter((perRow) => dotsFit(total, perRow));

/**
 * Equal amounts: the same number of dots, arranged another way.
 *
 * The published sample is a column of four cubes set against a two-by-two
 * block of them. What it asks is whether a number survives being rearranged,
 * which is a real thing a fourth grader can get wrong -- so every wrong option
 * is a *different total*, and there is no shortcut through the shape of the
 * picture. The only way through is to count.
 *
 * The arrangements are rows of a given width rather than full rectangles, and
 * that is what keeps it honest. Rectangles read more neatly, but a number has
 * only a handful of them and the answer would nearly always be the prompt
 * turned on its side -- "find the same two numbers the other way round", which
 * can be done without counting anything. Rows of six with two left over is
 * still a picture of twenty, and it has no such shape to match on. Right and
 * wrong options come from the same pool, so a short last row is never itself a
 * clue.
 */
const equalAmounts: GeneratorFn = (rng, level) => {
  const [lo, hi] = level <= 1 ? [6, 11] : level === 2 ? [8, 15] : level === 3 ? [10, 20] : [14, 28];
  let total = 0;
  let shownRow = 0;
  let answerRow = 0;
  for (let attempt = 0; attempt < 30 && !total; attempt++) {
    const n = rng.int(lo, hi);
    const ways = layoutsFor(n);
    if (ways.length < 2) continue;
    [shownRow, answerRow] = rng.sample(ways, 2);
    total = n;
  }
  if (!total) [total, shownRow, answerRow] = [12, 6, 4];

  // Wrong totals, nearest first. Each is laid out at random from the same set
  // of arrangements the answer was drawn from.
  const wrong: string[] = [];
  for (const d of [1, -1, 2, -2, 3, -3, 4, -4]) {
    const n = total + d;
    const ways = layoutsFor(n);
    if (n < 2 || !ways.length || wrong.length >= 4) continue;
    wrong.push(dotArraySvg(n, rng.pick(ways)));
  }

  const shape = (n: number, perRow: number) => {
    const rows = Math.ceil(n / perRow);
    if (rows === 1) return `a single row of ${n}`;
    if (perRow === 1) return `a single column of ${n}`;
    const over = n % perRow;
    return over === 0 ? `${rows} rows of ${perRow}` : `rows of ${perRow}, with ${over} left over`;
  };

  return figureChoice(rng, {
    instructions: "Count the dots in the picture.",
    stem: "Which one shows the **same number** of dots?",
    figure: dotArraySvg(total, shownRow),
    answerFigure: dotArraySvg(total, answerRow),
    distractorFigures: wrong,
    options: OPTIONS,
    explanation: `The picture is ${shape(total, shownRow)} — ${total} dots. The answer is ${shape(total, answerRow)}, which is ${total} as well. Every other option is a different number.`,
    hint: "Count one row, then count the rows. Do the same to each option instead of comparing the shapes.",
  });
};

export const ngatGenerators: Record<string, GeneratorFn> = {
  "ngat-odd-one-out": oddOneOut,
  "ngat-figure-matrices": figureMatrices,
  "ngat-serial-reasoning": serialReasoning,
  "ngat-spatial-visualization": spatialVisualization,
  "ngat-pattern-completion": patternCompletion,
  "ngat-number-series": numberSeries,
  "ngat-number-analogies": numberAnalogies,
  "ngat-number-matrices": numberMatrices,
  "ngat-equal-amounts": equalAmounts,
};
