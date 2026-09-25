import { choice, figureChoice, num, type GeneratorFn, type Params } from "./helpers";
import { NGAT_BANKS, pool, type VerbalBand } from "./exam-banks";
import {
  COUNTABLE_OBJECTS, countAnalogySvg, countCardSvg, parsePicture, pictureCardSvg,
  pictureMatrixSvg, pictureRowSvg,
} from "./pictures";
import {
  MATRIX_CELL, PAN_UNIT, TARGET_SPAN, balanceSvg, cellsKey, cutoutSvg, matrixSvg, normalize,
  numberGridSvg, panSvg, patchSvg, piecesSvg, targetSvg,
  type Cell, type Design, type Family, type Window,
} from "./grids";
import {
  ROOMY, SHADINGS, SHAPES, SHAPE_WORDS, cellRoom, describe, figLook, figSvg, fitUnit, sameLook,
  type Fig, type Shading, type ShapeName,
} from "./shapes";
import {
  DARKER, FALLBACK, KINSHIPS, LIGHTER, PROPS, RULE_MAKERS, TURNABLE, TWINS, ambiguous, anyShape,
  plural, turnBy, unlike, type Rule,
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

/**
 * Which form a grade sits.
 *
 * The Naglieri tests are levelled by grade band, and the bands do not line up
 * with each other: a first grader sits the 1st-grade nonverbal and
 * quantitative forms and the K-2 verbal one, a fourth grader the 3rd-4th forms
 * and the 3rd-6th verbal. So this is not a difficulty dial bolted onto one
 * form. It decides which questions get asked at all -- whether the grid is
 * ever three across, whether the numbers ever multiply, which bank the verbal
 * item draws from -- and each grade's four levels then ramp inside that.
 *
 * The grade arrives as a parameter because `generateQuestion` hands every
 * generator the grade of the catalog entry it is serving.
 */
interface Form {
  band: VerbalBand;
  /** how far past `level` the figure rules and the series tiers reach */
  reach: number;
  /** the biggest grid this form asks anyone to read */
  grid: 2 | 3;
  /** the most objects one box may hold and stay countable at a glance */
  maxSet: number;
  /** whether the quantitative items multiply, or only add and take away */
  times: boolean;
  /** how high the numerals go */
  ceiling: number;
  /** how many numbers a series prints, the missing one included */
  terms: number;
}

const FORMS: Record<number, Form> = {
  1: { band: "K-2", reach: 0, grid: 2, maxSet: 6, times: false, ceiling: 20, terms: 5 },
  4: { band: "3-6", reach: 2, grid: 3, maxSet: 9, times: true, ceiling: 999, terms: 6 },
};

const formOf = (params: Params): Form => FORMS[num(params, "grade", 4)] ?? FORMS[4];

/** Whether this form ever prints the bigger grid, at this level. */
const wide = (form: Form, level: number) => form.grid === 3 && level >= 3;

/** The hardest tier of rule or series a level may reach on this form. */
const tierCap = (form: Form, level: number) => Math.min(4, level + form.reach);

/* ----------------------------------------------------------------- verbal */

/**
 * The Naglieri verbal test asks three things, and this is all three.
 *
 * Worth stating because it was got wrong here once. The verbal test is not one
 * item type: the published walkthrough demonstrates six pictures with an odd
 * one out, a picture analogy, and a pair to find across two rows. Three skills
 * here, one per item type -- where an earlier version had one item type split
 * two ways by a distinction we invented to fill the gap.
 *
 * All three are cut by `band`, which is the test's own: the verbal test is
 * levelled K-2, 3-6 and 7-12, and a first grader's form is not a fourth
 * grader's with the hard items taken out. None of them prints a word, for the
 * same reason the real test does not.
 */

/**
 * Six pictures, five with something in common.
 *
 * Nothing is given as a worked example. CogAT's classification shows three
 * that belong and asks for a fourth, which tells the child the category exists
 * before they start looking; here the group and the outsider arrive together
 * and finding the idea is the item.
 *
 * What the five share may be what they are (all insects) or what they do or
 * have (all give off their own light, all come in a pair). The bank records
 * which, because the two are worth writing deliberately, but they are one
 * skill: the child is not told which kind of idea to look for, and neither is
 * the reader of a practice question.
 */
const oddOneOut: GeneratorFn = (rng, level, params) => {
  const { band } = formOf(params);
  const item = rng.pick(pool(NGAT_BANKS.oddOneOut.filter((i) => i.band === band), level));
  return figureChoice(rng, {
    instructions: "Five of these six pictures are alike in one way.",
    stem: "Which picture does **not** belong with the others?",
    answerFigure: pictureCardSvg(item.odd),
    distractorFigures: item.group.map(pictureCardSvg),
    options: VERBAL_OPTIONS,
    explanation: `Five of them are alike: ${item.concept}. ${item.why}`,
    hint: "Name each picture out loud. If what they are gets you nowhere, ask what each one does, or what each one has.",
  });
};

/**
 * A picture analogy: the top pair go together, so what goes with the third?
 *
 * Drawn as four boxes with no arrow. The relation may be semantic -- a cow
 * gives milk, a saw cuts wood -- or an attribute the pair share, which is the
 * example the walkthrough leads with: two yellow things above, one green thing
 * below, so the answer is another green thing. A bank of only the first kind
 * would be half an item type.
 */
const pictureAnalogies: GeneratorFn = (rng, level, params) => {
  const { band } = formOf(params);
  const item = rng.pick(pool(NGAT_BANKS.pictureAnalogies.filter((i) => i.band === band), level));
  const say = (p: string) => parsePicture(p).word;
  return figureChoice(rng, {
    instructions: "The two pictures at the top go together in some way.",
    stem: "Which picture belongs in the empty box?",
    figure: pictureMatrixSvg(item.a, item.b, item.c),
    answerFigure: pictureCardSvg(item.answer),
    distractorFigures: item.wrong.map(pictureCardSvg),
    options: OPTIONS,
    explanation: item.why,
    hint: `Say how the top two go together: "${say(item.a)} and ${say(item.b)} because..." Then say the same sentence about ${say(item.c)}.`,
  });
};

/**
 * "Which two go together?": one picture in the row above has a partner among
 * the answers, and the rest have none.
 *
 * On the real test the child picks two, one from each of two rows. Ours shows
 * the first row and asks for the one option that partners something in it.
 * That is the same search -- read both sets, find the single link -- narrowed
 * to the one answer a multiple choice can key, and it keeps the part that
 * makes the item hard: you are not told which picture the link runs to.
 */
const picturePairs: GeneratorFn = (rng, level, params) => {
  const { band } = formOf(params);
  const item = rng.pick(pool(NGAT_BANKS.pairs.filter((i) => i.band === band), level));
  return figureChoice(rng, {
    instructions: "One of these pictures goes with one of the pictures above it.",
    stem: "Which picture goes with one of the three?",
    figure: pictureRowSvg(item.top),
    answerFigure: pictureCardSvg(item.answer),
    distractorFigures: item.wrong.map(pictureCardSvg),
    options: OPTIONS,
    explanation: item.why,
    hint: "Take the three at the top one at a time, and check every answer against that one before you move on.",
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
function analogyMatrix(rng: Rng, level: number, form: Form): ReturnType<GeneratorFn> {
  // A fourth grader starts where CogAT's top tiers leave off, so level 1 on
  // that form already draws on rules that are level 3 material for a
  // six-year-old. A first grader's form walks the same list from the bottom.
  const makers = RULE_MAKERS.filter((m) => m.tier <= tierCap(form, level));

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
function progressionMatrix(rng: Rng, level: number, form: Form): ReturnType<GeneratorFn> {
  const makers = SERIES_MAKERS.filter((m) => m.tier <= tierCap(form, level));
  const grid = buildGrid(rng, makers) ?? buildGrid(rng, SERIES_MAKERS.filter((m) => m.tier <= 2));
  // Nothing drew: fall back to the two-by-two, which cannot fail.
  if (!grid) return analogyMatrix(rng, level, form);

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

/**
 * Figure matrices: four boxes at the bottom of a form, nine at the top of it.
 *
 * The three-by-three is the fourth-grade form's, and not because it is harder
 * arithmetic -- it asks a different question. Two boxes over two show one rule
 * and ask you to apply it; nine show two rules at once and ask you to find
 * where they meet. A first grader's form stays at four all the way up, and
 * ramps through the rules instead.
 */
const figureMatrices: GeneratorFn = (rng, level, params) => {
  const form = formOf(params);
  return wide(form, level) ? progressionMatrix(rng, level, form) : analogyMatrix(rng, level, form);
};

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
 * On the first-grade form, and at the bottom of the fourth-grade one, it is a
 * plain sequence read the way a page is read -- two rows of three, the cycle
 * starting again on the second row -- which is the form the published sample
 * shows. Above that it is the square the test is known for: three states
 * arranged so that no row and no column repeats one, which cannot be answered
 * by continuing left to right.
 */
const serialReasoning: GeneratorFn = (rng, level, params) => {
  const form = formOf(params);
  const square = wide(form, level);
  const makers = SERIES_MAKERS.filter((m) => m.tier <= Math.max(2, tierCap(form, level)));
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
  if (!series) return analogyMatrix(rng, level, form);

  // Which state sits in each cell. Reading order at the bottom two levels; a
  // Latin square -- every state once per row and once per column -- above.
  const shift = rng.pick([1, 2]);
  const offset = rng.int(0, 2);
  const rows = square ? 3 : 2;
  const at = (r: number, c: number) =>
    square ? (r * shift + c + offset) % 3 : (r * 3 + c + offset) % 3;

  const [mr, mc] = square ? [rng.int(0, rows - 1), rng.int(0, 2)] : [rows - 1, 2];
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
    instructions: square
      ? "Every row has each figure once, and so does every column."
      : "The same few figures keep coming round, in order.",
    stem: "Which figure belongs where the **?** is?",
    figure: matrixSvg(cells, unit),
    options: OPTIONS,
    answerFigure: figSvg(answer, unit, MATRIX_CELL),
    distractorFigures: wrong.map((f) => figSvg(f, unit, MATRIX_CELL)),
    explanation: square
      ? `Three figures appear once in every row and once in every column, and ${series.words}. That row and that column both still need ${describe(answer)}.`
      : `Read the boxes the way you read a page. Three figures keep repeating, and ${series.words}. The next one round is ${describe(answer)}.`,
    hint: square
      ? "Cover everything but the row with the ? in it. Which of the three is missing from it?"
      : "Say the figures out loud in order, and keep going past the end of the first row.",
  });
};

/* -------------------------------------------------- figure odd one out */

/**
 * Five figures, four alike.
 *
 * The same question the verbal test opens with, asked about shapes: the
 * walkthrough shows five designs where "there's always two blocks on the
 * bottom, but this one doesn't have it", and another where "one of the designs
 * is half of the other design, except right here". It is CogAT's
 * classification turned round -- that shows three that belong and asks for a
 * fourth, this shows the group and the outsider together and asks which is
 * which -- so it runs on the same kinships over the same figures.
 *
 * As there, the five figures are the options; there is nothing to show above
 * them.
 */
const figureOddOneOut: GeneratorFn = (rng, level, params) => {
  const form = formOf(params);
  const makers = KINSHIPS.filter((k) => k.tier <= tierCap(form, level));

  let words = "";
  let alike: Fig[] = [];
  let odd: Fig | null = null;

  outer: for (let pick = 0; pick < 14; pick++) {
    const maker = rng.pick(makers);
    for (let draw = 0; draw < 8; draw++) {
      const kin = maker.make(rng);
      const seen = new Set<string>();
      const take = (build: () => Fig, n: number): Fig[] => {
        const out: Fig[] = [];
        for (let i = 0; i < 40 && out.length < n; i++) {
          const f = build();
          const look = figLook(f);
          if (seen.has(look) || !readable(f)) continue;
          seen.add(look);
          out.push(f);
        }
        return out;
      };
      const four = take(() => kin.member(rng), 4);
      const [out] = take(() => kin.outsider(rng), 1);
      if (four.length < 4 || !out) continue;
      // The rule the item states has to leave out exactly one of the five.
      if (!four.every(kin.holds) || kin.holds(out)) continue;
      if (!onlyOutsider([...four, out], out)) continue;
      words = kin.words;
      alike = four;
      odd = out;
      break outer;
    }
  }
  if (!odd) ({ words, alike, odd } = plainOdd(rng));

  const unit = fitUnit([...alike, odd], cellRoom(MATRIX_CELL));
  return figureChoice(rng, {
    instructions: "Four of these five figures are alike in one way.",
    stem: "Which figure does **not** belong with the others?",
    options: OPTIONS,
    answerFigure: figSvg(odd, unit, MATRIX_CELL),
    distractorFigures: alike.map((f) => figSvg(f, unit, MATRIX_CELL)),
    explanation: `Four of them are alike in one way: ${words}. Only ${describe(odd)} is not.`,
    hint: "Check one thing at a time across all five: the shape, how many, how dark, how big — and what is inside.",
  });
};

/**
 * Whether the keyed figure is the only one any reading leaves out.
 *
 * The inverse of the check the classification item makes. Four figures agree
 * on the kinship the item was built around, and on whatever else fell out the
 * same way by chance -- and each of those is a rule a child might settle on.
 * If any of them singles out a different figure, that child is marked wrong
 * for reasoning correctly.
 */
function onlyOutsider(figs: Fig[], answer: Fig): boolean {
  for (const prop of PROPS) {
    const values = figs.map(prop);
    if (values.some((v) => v === null)) continue;
    const groups = new Map<string, Fig[]>();
    values.forEach((v, i) => groups.set(v as string, [...(groups.get(v as string) ?? []), figs[i]]));
    if (groups.size !== 2) continue;
    const lone = [...groups.values()].find((g) => g.length === 1);
    if (lone && lone[0] !== answer) return false;
  }
  return true;
}

/**
 * An item that cannot fail, for when every draw above has.
 *
 * Sound by construction: four of one shape whose shadings, sizes and counts
 * are spread so that no second property is held by exactly four of the five,
 * and one figure of a shape nobody would mistake for it.
 */
function plainOdd(rng: Rng): { words: string; alike: Fig[]; odd: Fig } {
  const shape = anyShape(rng);
  const at = (shading: Shading, size: 1 | 2, count: 1 | 2 | 3): Fig => ({ shape, shading, size, count });
  return {
    words: `they are all ${plural(shape)}`,
    alike: [at("open", 1, 1), at("shaded", 2, 2), at("solid", 1, 3), at("shaded", 2, 1)],
    odd: { shape: rng.pick(unlike(shape)), shading: "open", size: 1, count: 2 },
  };
}

/* --------------------------------------------------- spatial visualization */

/**
 * The pieces a shape can be cut into.
 *
 * Every one of them fits a three-by-two, which is what an option's slot holds.
 * What matters more than the list is that it carries **several different
 * pieces of the same size** -- two of three squares, five of four. Without
 * that there is no such thing as a wrong option with the right number of
 * squares, and the item collapses into counting: a child rules out every
 * option but one without ever trying to lay a piece on the shape.
 */
const cells = (...pairs: [number, number][]): Cell[] => pairs.map(([c, r]) => ({ c, r }));

const PIECES: Cell[][] = [
  cells([0, 0], [1, 0]),                                     // two in a line
  cells([0, 0], [1, 0], [2, 0]),                             // three in a line
  cells([0, 0], [1, 0], [0, 1]),                             // three in a corner
  cells([0, 0], [1, 0], [0, 1], [1, 1]),                     // a square of four
  cells([0, 0], [1, 0], [2, 0], [0, 1]),                     // four, with a foot
  cells([0, 0], [1, 0], [2, 0], [2, 1]),                     // four, footed the other way
  cells([0, 0], [1, 0], [1, 1], [2, 1]),                     // four, stepped
  cells([0, 0], [1, 0], [2, 0], [1, 1]),                     // four, with a stub
];

/** A piece at each of its distinct quarter turns. */
function rotations(piece: Cell[]): Cell[][] {
  const out: Cell[][] = [];
  let cur = normalize(piece);
  for (let i = 0; i < 4; i++) {
    if (!out.some((o) => cellsKey(o) === cellsKey(cur))) out.push(cur);
    cur = normalize(cur.map((p) => ({ c: -p.r, r: p.c })));
  }
  return out;
}

/**
 * Whether these pieces cover the shape exactly, turned any way you like.
 *
 * This is what makes the item honest. The keyed option is right by
 * construction -- the shape was built by laying those pieces down -- but a
 * wrong option is only wrong if it genuinely cannot be made to fit, and a
 * child is free to turn a piece round. So every wrong option is run through
 * here before it is offered.
 */
export function fits(target: Cell[], pieces: Cell[][]): boolean {
  const cells = normalize(target);
  if (pieces.reduce((n, p) => n + p.length, 0) !== cells.length) return false;
  const free = new Set(cells.map((p) => `${p.c},${p.r}`));
  const shapes = pieces.map(rotations);
  const used = shapes.map(() => false);

  const place = (): boolean => {
    // Always fill the first uncovered square, so the search never explores two
    // orderings of the same placement.
    const spot = cells.find((p) => free.has(`${p.c},${p.r}`));
    if (!spot) return true;
    for (let i = 0; i < shapes.length; i++) {
      if (used[i]) continue;
      for (const turned of shapes[i]) {
        for (const anchor of turned) {
          const put = turned.map((p) => ({
            c: p.c + spot.c - anchor.c,
            r: p.r + spot.r - anchor.r,
          }));
          if (!put.every((p) => free.has(`${p.c},${p.r}`))) continue;
          used[i] = true;
          put.forEach((p) => free.delete(`${p.c},${p.r}`));
          if (place()) return true;
          put.forEach((p) => free.add(`${p.c},${p.r}`));
          used[i] = false;
        }
      }
    }
    return false;
  };
  return place();
}

/** A shape built by laying `count` pieces down inside a small grid. */
function buildShape(rng: Rng, count: number): { target: Cell[]; pieces: Cell[][] } | null {
  for (let attempt = 0; attempt < 60; attempt++) {
    const taken = new Set<string>();
    const cells: Cell[] = [];
    const pieces: Cell[][] = [];
    for (let n = 0; n < count; n++) {
      let placed = false;
      for (let go = 0; go < 30 && !placed; go++) {
        const turned = rng.pick(rotations(rng.pick(PIECES)));
        const w = Math.max(...turned.map((p) => p.c)) + 1;
        const h = Math.max(...turned.map((p) => p.r)) + 1;
        const dc = rng.int(0, TARGET_SPAN - w);
        const dr = rng.int(0, TARGET_SPAN - h);
        const put = turned.map((p) => ({ c: p.c + dc, r: p.r + dr }));
        if (put.some((p) => taken.has(`${p.c},${p.r}`))) continue;
        // Every piece after the first has to touch what is already there, or
        // the shape falls into two shapes and is not one figure.
        const touches =
          n === 0 ||
          put.some((p) =>
            [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([x, y]) => taken.has(`${p.c + x},${p.r + y}`)),
          );
        if (!touches) continue;
        put.forEach((p) => taken.add(`${p.c},${p.r}`));
        cells.push(...put);
        pieces.push(normalize(turned));
        placed = true;
      }
      if (!placed) break;
    }
    if (pieces.length === count) return { target: normalize(cells), pieces };
  }
  return null;
}

/** Pieces in one fixed order, so the same set always draws the same picture. */
const inOrder = (pieces: Cell[][]) => [...pieces].sort((a, b) => cellsKey(a).localeCompare(cellsKey(b)));
const setKey = (pieces: Cell[][]) => inOrder(pieces).map(cellsKey).join(" / ");

/**
 * Spatial visualization: which pieces make the shape?
 *
 * The walkthrough's last nonverbal item -- "three pieces are going to combine
 * to make this figure on top" -- and the one place a wrong option cannot be
 * hand-waved: a child may turn a piece round, so `fits` runs every wrong set
 * through an exhaustive placement search before it is offered. An option that
 * has the right number of squares but cannot be made to cover the shape is the
 * item working; an option that quietly can is two right answers.
 */
const spatialVisualization: GeneratorFn = (rng, level, params) => {
  const form = formOf(params);
  const count = wide(form, level) ? 3 : 2;
  const built = buildShape(rng, count) ?? buildShape(rng, 2);
  if (!built) return figureOddOneOut(rng, level, params);
  const { target, pieces } = built;

  const seen = new Set([setKey(pieces)]);
  const wrong: Cell[][][] = [];
  const offer = (set: Cell[][]) => {
    const k = setKey(set);
    if (wrong.length >= 6 || seen.has(k)) return;
    if (fits(target, set)) return;
    seen.add(k);
    wrong.push(set);
  };
  // One piece swapped for another of the *same size* first. Those are the
  // options worth having: they have as many squares as the shape does, so the
  // only way to rule them out is to try to lay them on it. A swap that changes
  // the square count can be struck out by counting, which is a good first
  // move and a poor whole item -- so those come after, as the top-up.
  const swaps = (keep: boolean) => {
    for (const swap of rng.shuffle([...PIECES])) {
      for (let i = 0; i < pieces.length; i++) {
        if ((swap.length === pieces[i].length) !== keep) continue;
        offer(pieces.map((p, j) => (j === i ? normalize(swap) : p)));
      }
    }
  };
  swaps(true);
  // Two pieces changed at once, still keeping the count, before giving up on it.
  for (let i = 0; i < 24 && wrong.length < 4; i++) {
    const swapped = pieces.map((p) => {
      const same = PIECES.filter((q) => q.length === p.length);
      return normalize(rng.pick(same));
    });
    offer(swapped);
  }
  swaps(false);
  for (let i = 0; i < 20 && wrong.length < 6; i++) {
    offer(Array.from({ length: count }, () => normalize(rng.pick(PIECES))));
  }
  offer(pieces.slice(0, count - 1));

  return figureChoice(rng, {
    instructions: "These pieces can be turned round, but never flipped over.",
    stem: "Which pieces fit together to make the shape?",
    figure: targetSvg(target),
    options: OPTIONS,
    answerFigure: piecesSvg(inOrder(pieces)),
    distractorFigures: wrong.map((set) => piecesSvg(inOrder(set))),
    explanation: `The shape is ${target.length} squares. Most of the wrong sets have ${target.length} squares too — they just cannot be laid on it without an overlap or a gap.`,
    hint: "Counting the squares rules out one or two. For the rest, find the tightest corner of the shape and work out which piece could possibly fill it.",
  });
};

/* ------------------------------------------------------ pattern completion */

const ANGLES: Family["angle"][] = [0, 90, 45, 135];
/** Wide enough to count, close enough that every window shows at least one. */
const SPACINGS = [26, 32, 38, 44];

function makeFamilies(rng: Rng, level: number, form: Form): Family[] {
  // The first-grade form keeps to one set of lines, further apart, and only
  // slants them once the bottom two levels are behind it. Two sets crossing is
  // a fourth-grade question: it is not one pattern read more carefully, it is
  // two patterns that both have to hold through the same hole.
  const straightOnly = level <= (form.grid === 2 ? 2 : 1);
  const angles: Family["angle"][] = rng.shuffle(straightOnly ? [0, 90] : [...ANGLES]);
  // Wider spacing while the lines are still straight, so the first thing a
  // six-year-old has to track is a couple of lines rather than six.
  const spacings = form.grid === 2 && level <= 2 ? SPACINGS.slice(2) : SPACINGS;
  const howMany = wide(form, level) ? 2 : 1;
  return angles.slice(0, howMany).map((angle, i) => {
    const spacing = rng.pick(spacings);
    return {
      angle,
      spacing,
      phase: rng.int(0, spacing - 1),
      dashed: form.grid === 3 && level >= 4 && i === 1,
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

const patternCompletion: GeneratorFn = (rng, level, params) => {
  const families = makeFamilies(rng, level, formOf(params));
  const design: Design = { families };
  const where: Window = { col: rng.int(0, 2), row: rng.int(0, 2) };

  // One wrong option per kind of mistake, and only one of them at the wrong
  // angle. Every angle the pattern is not used to be offered, which on a
  // one-family design meant three of the four wrong pieces could be ruled out
  // without looking at the hole at all -- leaving a five-option item that was
  // really a choice between two.
  const spoil: Design[] = [];
  const spare: Design[] = [];
  families.forEach((f, i) => {
    const swap = (over: Partial<Family>): Design => ({
      families: families.map((g, j) => (j === i ? { ...g, ...over } : g)),
    });
    const elsewhere = ANGLES.filter((a) => a !== f.angle);
    spoil.push(swap({ phase: f.phase + Math.round(f.spacing / 2) }));
    spoil.push(swap({ spacing: f.spacing === SPACINGS[0] ? SPACINGS[2] : SPACINGS[0] }));
    spoil.push(swap({ angle: rng.pick(elsewhere) }));
    spoil.push(swap({ dashed: !f.dashed }));
    if (families.length > 1) spoil.push({ families: families.filter((_, j) => j !== i) });
    // Only reached when two of the four above draw the same lines through this
    // particular window, which a small hole makes possible.
    for (const angle of elsewhere) spare.push(swap({ angle }));
    spare.push(swap({ phase: f.phase + Math.round(f.spacing / 3) }));
  });

  return figureChoice(rng, {
    instructions: "A square piece has been cut out of this pattern.",
    stem: "Which piece fills the hole?",
    figure: cutoutSvg(design, where),
    options: OPTIONS,
    answerFigure: patchSvg(design, where),
    // Two spoiled designs can look the same through one small window;
    // `figureChoice` keeps the first of each and drops the repeats, and the
    // spares are there so that dropping one never leaves the item short.
    distractorFigures: [...rng.shuffle(spoil), ...rng.shuffle(spare)].map((d) => patchSvg(d, where)),
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

function makeRun(rng: Rng, level: number, form: Form): Run {
  const n = form.terms;
  const small = !form.times;
  // A first grader's form adds, takes away, and repeats. Doubling and widening
  // gaps are not those rules made harder -- they want multiplication and a
  // second difference, neither of which anything else on that form asks for.
  const kinds = small
    ? level <= 1
      ? ["add"]
      : level === 2
        ? ["add", "repeat"]
        : ["add", "subtract", "repeat"]
    : level <= 1
      ? ["add"]
      : level === 2
        ? ["add", "subtract"]
        : level === 3
          ? ["add", "subtract", "multiply", "growing"]
          : ["subtract", "multiply", "growing", "alternate", "repeat"];

  switch (rng.pick(kinds)) {
    case "subtract": {
      const d = rng.int(small ? 1 : 2, small ? 3 : level >= 3 ? 12 : 9);
      const floor = d * (n - 1) + 1;
      const start = rng.int(floor, Math.min(form.ceiling, floor + (small ? 5 : 40)));
      return { terms: run(n, start, (t) => t - d), words: `Take ${d} away each time`, spread: d };
    }
    case "multiply": {
      const k = rng.pick([2, 3]);
      const start = rng.int(1, k === 2 ? 5 : 3);
      return { terms: run(Math.min(5, n), start, (t) => t * k), words: k === 2 ? "Double each time" : `Multiply by ${k} each time`, spread: start * k * 2 };
    }
    case "growing": {
      const first = rng.int(1, 6);
      const grow = rng.int(1, level >= 4 ? 4 : 2);
      let gap = first;
      const start = rng.int(1, 12);
      const terms = run(n, start, (t) => {
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
      const terms = run(n, start, (t) => t + (i++ % 2 === 0 ? up : -down));
      return { terms, words: `Add ${up}, then take ${down} away, over and over`, spread: up };
    }
    case "repeat": {
      // Drawn from ranges that cannot collide, so the cycle never repeats a
      // number and "the same two keep coming round" stays true of the picture.
      const pool = small ? [rng.int(1, 9), rng.int(10, 20)] : [rng.int(2, 9), rng.int(10, 29), rng.int(30, 60)];
      const cycle = rng.sample(pool, small ? 2 : rng.pick([2, 3]));
      const terms = Array.from({ length: n }, (_, i) => cycle[i % cycle.length]);
      return { terms, words: `The same ${cycle.length} numbers keep coming round`, spread: small ? 6 : 12 };
    }
    default: {
      // The floor rises with the ceiling, or a top-level run comes out as
      // "add 1" and is easier than a bottom-level one.
      const d = small
        ? rng.int(level <= 2 ? 1 : 2, level <= 2 ? 3 : 4)
        : rng.int(level >= 3 ? 4 : 2, level >= 2 ? 12 : 9);
      // Every term has to stay inside what this form's numerals reach, so the
      // run starts low enough that its last one still does.
      const start = rng.int(1, Math.max(1, Math.min(20, form.ceiling - d * (n - 1))));
      return { terms: run(n, start, (t) => t + d), words: `Add ${d} each time`, spread: d };
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
const numberSeries: GeneratorFn = (rng, level, params) => {
  const form = formOf(params);
  let { terms, words, spread } = makeRun(rng, level, form);
  // Nobody sitting this has met negative numbers, so a run that dips below
  // zero is not a harder item -- it is one asking something it never taught.
  if (terms.some((t) => t < 0)) ({ terms, words, spread } = makeRun(rng, 1, form));
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
 * Fourth grade is where this stops being addition: that form's top tiers
 * double and treble, which is why its boxes hold up to nine. A first grader's
 * form adds and takes away inside six, the same ceiling CogAT's Level 7 uses,
 * because seven of anything in a box is a counting test and this is not one.
 */
const numberAnalogies: GeneratorFn = (rng, level, params) => {
  const form = formOf(params);
  // The walkthrough shows the item both ways round: a very easy one counted
  // out in birds, and harder ones written as "10 is to 5 as 8 is to 4 as 12 is
  // to what". Drawn while the relation is a small step, written once it is
  // not -- a set of eighteen things in a box stops being an analogy and starts
  // being a counting test.
  if (level >= 3) return writtenAnalogy(rng, level, form);
  const MAX_SET = form.maxSet;
  interface Change {
    to: (n: number) => number;
    words: string;
    /** counts this change can start from and still fit the box */
    from: number[];
    tier: 1 | 2 | 3 | 4;
    /** whether it needs multiplying, which not every form asks for */
    times?: boolean;
  }
  const all: Change[] = [
    ...([1, 2, 3, 4] as const).map((d) => ({
      to: (n: number) => n + d, words: `${d} more`, from: range(1, MAX_SET - d),
      tier: (d <= 2 ? 1 : d === 3 ? 2 : 3) as 1 | 2 | 3,
    })),
    ...([1, 2, 3] as const).map((d) => ({
      to: (n: number) => n - d, words: `${d} fewer`, from: range(d + 1, MAX_SET),
      tier: (d <= 2 ? 2 : 3) as 2 | 3,
    })),
    ...([2, 3, 4] as const).map((k) => ({
      to: (n: number) => n * k, words: `${k} times as many`,
      from: range(1, Math.floor(MAX_SET / k)), tier: (k === 2 ? 3 : 4) as 3 | 4, times: true,
    })),
    { to: (n: number) => n / 2, words: "half as many", from: [2, 4, 6, 8], tier: 4, times: true },
    { to: (n: number) => n / 3, words: "a third as many", from: [3, 6, 9], tier: 4, times: true },
  ];

  // A change needs two starting counts: one for the worked row and a different
  // one for the row being asked about, so the rule cannot be read as "copy the
  // box above". A change whose starting counts have run out of box -- four
  // times as many, in a box that holds six -- drops out here rather than being
  // listed twice.
  const changes = all.filter(
    (c) => c.tier <= tierCap(form, level) && (form.times || !c.times) && c.from.length >= 2,
  );
  const change = rng.pick(changes.length ? changes : all.filter((c) => c.from.length >= 2));
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

/**
 * The same analogy written in numerals: `a` is to `b` as `c` is to what?
 *
 * Two rows at the bottom levels of this form and three at the top, which is
 * how the walkthrough steps it up -- a third worked pair does not make the
 * arithmetic harder, it makes the relation harder to be sure of, because two
 * pairs can agree by accident and three rarely do.
 */
function writtenAnalogy(rng: Rng, level: number, form: Form): ReturnType<GeneratorFn> {
  interface Step {
    to: (n: number) => number;
    words: string;
    from: number[];
    times?: boolean;
  }
  const top = form.ceiling <= 20 ? 20 : 144;
  const whole = (n: number) => Number.isInteger(n) && n >= 1 && n <= top;
  const steps: Step[] = [
    ...range(2, form.ceiling <= 20 ? 5 : 12).map((d) => ({
      to: (n: number) => n + d, words: `add ${d}`, from: range(1, top - d),
    })),
    ...range(2, form.ceiling <= 20 ? 5 : 12).map((d) => ({
      to: (n: number) => n - d, words: `take away ${d}`, from: range(d + 1, top),
    })),
    ...[2, 3, 4].map((k) => ({
      to: (n: number) => n * k, words: `multiply by ${k}`, from: range(1, Math.floor(top / k)), times: true,
    })),
    ...[2, 3, 4].map((k) => ({
      to: (n: number) => n / k, words: `halve it`, from: range(1, top).filter((n) => n % k === 0), times: true,
    })).map((step, i) => (i === 0 ? step : { ...step, words: `divide by ${[2, 3, 4][i]}` })),
  ];
  const usable = steps.filter((st) => (form.times || !st.times) && st.from.length >= 3);
  const step = rng.pick(usable);

  // Three worked pairs at the top level, two below it.
  const shownPairs = level >= 4 ? 2 : 1;
  const seeds = rng.sample(step.from, shownPairs + 1);
  if (seeds.length < shownPairs + 1) return writtenAnalogy(rng, 3, form);
  const rows = seeds.map((n) => [n, step.to(n)]);
  const [ask] = rows.splice(shownPairs, 1);
  const answer = ask[1];

  // Near misses, and never the number already printed beside the blank -- an
  // option a reader can strike out by looking is an option given away.
  const wrong: number[] = [];
  const offer = (n: number) => {
    if (whole(n) && n !== answer && n !== ask[0] && !wrong.includes(n) && wrong.length < 4) wrong.push(n);
  };
  const spread = Math.max(2, Math.round(Math.abs(answer - ask[0]) / 2) + 1);
  for (const n of nearbyNumbers(rng, answer, spread, 8)) offer(n);
  for (let d = 1; wrong.length < 4 && d <= top; d++) {
    offer(answer + d);
    offer(answer - d);
  }

  const worked = rows.map(([a, b]) => `${a} is to ${b}`).join(", as ");
  return choice(rng, {
    instructions: "Each pair of numbers changes in the same way.",
    stem: "Which number belongs where the **?** is?",
    figure: numberGridSvg([...rows, [ask[0], null]]),
    answer: `${answer}`,
    options: OPTIONS,
    distractors: wrong.map(String),
    explanation: `${worked}: the rule is to ${step.words}. Doing the same to ${ask[0]} gives ${answer}.`,
    hint: "Work out what the first pair does, then check it against the second before you use it.",
  });
}

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
const numberMatrices: GeneratorFn = (rng, level, params) => {
  const form = formOf(params);
  const size = wide(form, level) ? 3 : 2;
  const small = !form.times;
  const dr = rng.int(small ? 1 : 2, small ? 5 : level >= 3 ? 20 : 12);

  /**
   * How a row moves as you read it right.
   *
   * Three ways, and the middle one is the walkthrough's own example -- a table
   * whose rows "added four and then subtracted two". A row that only ever
   * steps by one number is a row you can finish after seeing two of its cells;
   * a row that alternates has to be read all the way across, which is a
   * different question rather than a bigger one.
   */
  const mode: "step" | "cycle" | "times" =
    size === 2
      ? "step"
      : form.times && level >= 4 && rng.bool(0.35)
        ? "times"
        : rng.bool(0.45)
          ? "cycle"
          : "step";

  const dc = rng.intExcept(small ? 1 : 2, small ? 4 : level >= 3 ? 15 : 9, [dr]);
  const back = rng.intExcept(1, Math.max(2, dc - 1), [dc]);
  const times = mode === "times" ? rng.pick([2, 3]) : 1;
  const base = rng.int(mode === "cycle" ? back + 1 : 1, small ? 6 : 20);

  // What each column adds to the number its row starts on.
  const along = (c: number) =>
    mode === "cycle" ? Array.from({ length: c }, (_, i) => (i % 2 === 0 ? dc : -back)).reduce((a, b) => a + b, 0) : c * dc;
  const cell = (r: number, c: number) =>
    mode === "times" ? (base + r * dr) * times ** c : base + r * dr + along(c);

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
  const starts = grid.map((row) => row[0]).join(", ");
  const rule =
    mode === "times"
      ? `Each row multiplies by ${times} as you go right, and the rows begin ${starts} — ${dr} more each time`
      : mode === "cycle"
        ? `Along each row you add ${dc}, then take ${back} away, and so on; down each column you add ${dr}`
        : `Along each row you add ${dc} as you go right, and down each column you add ${dr}`;
  const distractors = [
    cell(mr, (mc + 1) % size),
    cell((mr + 1) % size, mc),
    ...nearbyNumbers(rng, answer, Math.max(2, mode === "times" ? dr : Math.min(dr, dc)), 4),
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

/**
 * Weight equivalency: what else would balance this?
 *
 * The walkthrough shows it twice -- "we have two items on the scale that are
 * equal, so which of these would also go on the scale and be equal", and a
 * harder pair of scales where one has to be evened up. Both are here, and the
 * step between them is the whole point of the item. The easy one asks only
 * whether a number survives being rearranged: the same things in a different
 * order still weigh the same. The hard one puts an exchange rate on the top
 * balance -- one of these weighs as much as three of those -- and then asks a
 * question that cannot be answered without spending it.
 *
 * Nothing is labelled with a number. The weights are what the top balance says
 * they are, which is what keeps it a reasoning item rather than arithmetic.
 */
const balance: GeneratorFn = (rng, level, params) => {
  const form = formOf(params);
  // Only shapes nobody has to squint at. A parallelogram and a trapezoid are
  // different shapes and, at the size a tray of them is drawn, the same wedge
  // -- and this item asks a child to tell one from another five times over.
  const WEIGHTS: ShapeName[] = ["circle", "square", "triangle", "star", "heart"];
  const [light, heavy] = rng.sample(WEIGHTS, 2);
  const weight = (s: ShapeName): Fig => ({ shape: s, shading: "solid", size: 1, count: 1 });
  const load = (h: number, l: number): Fig[] => [
    ...Array.from({ length: h }, () => weight(heavy)),
    ...Array.from({ length: l }, () => weight(light)),
  ];
  /** The most a pan holds and still be counted at a glance. */
  const PAN_MAX = 4;

  if (!wide(form, level)) {
    // One balance, and the only thing that changes is the order.
    const kinds = rng.sample(WEIGHTS, level <= 1 ? 2 : 3);
    const items = rng.shuffle(
      Array.from({ length: level <= 1 ? 3 : PAN_MAX }, (_, i) => weight(kinds[i % kinds.length])),
    );
    const tally = (set: Fig[]) => set.map((f) => f.shape).sort().join("+");
    const same = tally(items);

    const seen = new Set<string>();
    const wrong: Fig[][] = [];
    const offer = (set: Fig[]) => {
      const k = tally(set);
      if (wrong.length >= 5 || k === same || seen.has(k) || !set.length || set.length > PAN_MAX) return;
      seen.add(k);
      wrong.push(rng.shuffle([...set]));
    };
    for (let i = 0; i < items.length; i++) {
      offer(items.filter((_, j) => j !== i));                                   // one short
      offer(items.map((f, j) => (j === i ? weight(rng.pick(WEIGHTS.filter((w) => w !== f.shape))) : f))); // one swapped
    }
    offer([...items, weight(rng.pick(WEIGHTS))]);                                // one too many

    // Shuffled until the answer is not the picture it is answering: "the same
    // things in a different order" is the item, so the same order is not it.
    let answer = rng.shuffle([...items]);
    for (let i = 0; i < 12 && answer.every((f, j) => f.shape === items[j].shape); i++) {
      answer = rng.shuffle([...items]);
    }

    return figureChoice(rng, {
      instructions: "The balance is level, so both pans weigh the same.",
      stem: "Which pan would also balance against the one on the left?",
      figure: balanceSvg([{ left: items, right: null }], PAN_UNIT),
      options: OPTIONS,
      answerFigure: panSvg(answer, PAN_UNIT),
      distractorFigures: wrong.map((set) => panSvg(set, PAN_UNIT)),
      explanation: `The left pan holds ${describeLoad(items)}. The answer holds exactly the same things, just arranged differently, so it weighs the same. Every other pan is missing something, has something extra, or has the wrong thing.`,
      hint: "Count each kind of shape on the left, then count the same kinds in each answer.",
    });
  }

  // Two balances: the top one prices a heavy shape in light ones, and the
  // bottom one cannot be answered without using that price.
  const rate = rng.pick([2, 3]);
  const worth = (h: number, l: number) => h * rate + l;
  const loads: [number, number][] = [];
  for (let h = 0; h <= PAN_MAX; h++) {
    for (let l = 0; h + l <= PAN_MAX; l++) if (h + l > 0) loads.push([h, l]);
  }
  const byWorth = new Map<number, [number, number][]>();
  for (const [h, l] of loads) {
    const w = worth(h, l);
    byWorth.set(w, [...(byWorth.get(w) ?? []), [h, l]]);
  }
  const sharedWorth = [...byWorth.entries()].filter(([, set]) => set.length >= 2);
  const [total, ways] = rng.pick(sharedWorth);
  // The two sides are written differently on purpose: a bottom pan answered by
  // repeating what is opposite it would never need the top balance at all.
  const [[lh, ll], [ah, al]] = rng.sample(ways, 2);

  const seen = new Set([`${ah},${al}`, `${lh},${ll}`]);
  const wrong: Fig[][] = [];
  for (const [h, l] of rng.shuffle([...loads])) {
    if (wrong.length >= 5 || worth(h, l) === total || seen.has(`${h},${l}`)) continue;
    seen.add(`${h},${l}`);
    wrong.push(load(h, l));
  }

  const many = (n: number, s: ShapeName) => `${n} ${n === 1 ? SHAPE_WORDS[s] : plural(s)}`;
  return figureChoice(rng, {
    instructions: "Both balances are level, so each one weighs the same on either side.",
    stem: "Which pan would make the second balance level?",
    figure: balanceSvg(
      [
        { left: load(0, rate), right: load(1, 0) },
        { left: load(lh, ll), right: null },
      ],
      PAN_UNIT,
    ),
    options: OPTIONS,
    answerFigure: panSvg(load(ah, al), PAN_UNIT),
    distractorFigures: wrong.map((set) => panSvg(set, PAN_UNIT)),
    explanation: `The top balance shows that one ${SHAPE_WORDS[heavy]} weighs the same as ${many(rate, light)}. So the left pan below is worth ${many(total, light)}, and only ${describeLoad(load(ah, al))} comes to the same.`,
    hint: `Swap every ${SHAPE_WORDS[heavy]} for ${many(rate, light)}, then count.`,
  });
};

/** "two circles and a triangle", for an explanation or an answer key. */
function describeLoad(items: Fig[]): string {
  const counts = new Map<ShapeName, number>();
  for (const f of items) counts.set(f.shape, (counts.get(f.shape) ?? 0) + 1);
  const parts = [...counts.entries()].map(([s, n]) => `${n} ${n === 1 ? SHAPE_WORDS[s] : plural(s)}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
}

export const ngatGenerators: Record<string, GeneratorFn> = {
  "ngat-odd-one-out": oddOneOut,
  "ngat-picture-analogies": pictureAnalogies,
  "ngat-picture-pairs": picturePairs,
  "ngat-figure-matrices": figureMatrices,
  "ngat-serial-reasoning": serialReasoning,
  "ngat-figure-odd-one-out": figureOddOneOut,
  "ngat-spatial-visualization": spatialVisualization,
  "ngat-pattern-completion": patternCompletion,
  "ngat-number-series": numberSeries,
  "ngat-number-analogies": numberAnalogies,
  "ngat-number-matrices": numberMatrices,
  "ngat-balance": balance,
};
