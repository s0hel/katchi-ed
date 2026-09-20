import { choice, figureChoice, nearMisses, type GeneratorFn } from "./helpers";
import { COGAT_BANKS, pool } from "./exam-banks";
import {
  SHADINGS, SHAPES, analogyRowSvg, describe, figKey, figRowSvg, figSvg, foldedSlots, foldedSvg,
  holesKey, unfoldHoles, unfoldedSvg,
  type Attribute, type Fig, type Fold, type Hole, type Shading,
} from "./shapes";
import { abacusSvg, trainsSvg } from "./counters";
import {
  COUNTABLE_OBJECTS, countAnalogySvg, countCardSvg, parsePicture, pictureAnalogySvg, pictureCardSvg,
  pictureRowSvg,
} from "./pictures";
import type { Rng } from "../rng";

/**
 * CogAT practice, pitched at Level 7 -- the form first graders sit.
 *
 * The test has three batteries and this file follows them: verbal (picture
 * analogies, picture classification, sentence completion), quantitative
 * (number analogies, number puzzles, number series) and nonverbal (figure
 * matrices, figure classification, paper folding). Every item is multiple
 * choice, as on the test itself.
 *
 * What we are *not* trying to do is predict a score. CogAT is an ability
 * measure; drilling it does not make a child brighter. What practice does do
 * is remove the part of a low score that is only unfamiliarity -- a six-year-
 * old who has never seen a figure matrix spends the first ones learning what
 * is being asked rather than answering it.
 */

/* ----------------------------------------------------------------- verbal */

const READ_ALOUD = "Ask a grown-up to read this with you.";

const pictureAnalogies: GeneratorFn = (rng, level) => {
  const item = rng.pick(pool(COGAT_BANKS.pictureAnalogies, level));
  const say = (p: string) => parsePicture(p).word;
  return figureChoice(rng, {
    instructions: READ_ALOUD,
    stem: "Which picture goes in the empty box?",
    figure: pictureAnalogySvg(item.a, item.b, item.c),
    answerFigure: pictureCardSvg(item.answer),
    distractorFigures: item.wrong.map(pictureCardSvg),
    options: optionsFor(level),
    explanation: item.why,
    hint: `Say it out loud: "${say(item.a)} goes with ${say(item.b)} because..." Then try the same sentence for ${say(item.c)}.`,
  });
};

const pictureGroups: GeneratorFn = (rng, level) => {
  const item = rng.pick(pool(COGAT_BANKS.pictureGroups, level));
  return figureChoice(rng, {
    instructions: READ_ALOUD,
    stem: "These three go together. Which picture belongs with them?",
    figure: pictureRowSvg(item.group),
    answerFigure: pictureCardSvg(item.answer),
    distractorFigures: item.wrong.map(pictureCardSvg),
    options: optionsFor(level),
    explanation: item.why,
    hint: "Ask what is the same about all three.",
  });
};

const sentenceCompletion: GeneratorFn = (rng, level) => {
  const item = rng.pick(pool(COGAT_BANKS.sentenceCompletion, level));
  return figureChoice(rng, {
    instructions: READ_ALOUD,
    stem: item.s.replace("___", "**___**"),
    answerFigure: pictureCardSvg(item.answer),
    distractorFigures: item.wrong.map(pictureCardSvg),
    options: optionsFor(level),
    explanation: item.why,
    hint: "Say the whole sentence out loud with each picture in the blank. Only one of them makes sense.",
  });
};

/**
 * How many options a picture item offers. Three at the bottom tiers and four
 * higher up: on an item with nothing to read, the number of pictures to hold
 * in mind *is* most of the difficulty, and CogAT itself offers fewer options
 * at the lower levels for the same reason.
 */
const optionsFor = (level: number) => (level <= 2 ? 3 : 4);

/* ----------------------------------------------------------- quantitative */

/**
 * Wrong options near a right answer. A first grader has not met negative
 * numbers, so an option below zero is not a distractor -- it is a giveaway.
 */
function nearby(rng: Rng, answer: number, spread: number): string[] {
  return nearMisses(rng, answer, spread, 5).filter((v) => Number(v) >= 0).slice(0, 3);
}

/**
 * Number analogies, as sets of objects.
 *
 * Three pens become five pens, so two basketballs become how many? The rule is
 * about how many, never about which object, so the two rows deliberately use
 * different things: a child who matched on the object rather than the count
 * would get it wrong, which is the point.
 *
 * Counts stay between one and six. Seven of anything in a box is a counting
 * test, and this is not one.
 */
const numberAnalogies: GeneratorFn = (rng, level) => {
  const MAX_SET = 6;
  const deltas =
    level <= 1 ? [1, 2] : level === 2 ? [1, 2, 3] : level === 3 ? [2, 3, -1, -2] : [2, 3, 4, -2, -3];
  const delta = rng.pick(deltas);

  // Both pairs have to fit in the box at both ends of the rule.
  const low = Math.max(1, 1 - delta);
  const high = Math.min(MAX_SET, MAX_SET - delta);
  const topFrom = rng.int(low, high);
  // A second pair that starts somewhere else, so the rule cannot be read as
  // "copy the box above".
  const bottomFrom = rng.intExcept(low, high, [topFrom]);
  const answer = bottomFrom + delta;

  const [topPicture, bottomPicture] = rng.sample(COUNTABLE_OBJECTS, 2);

  // Wrong counts, nearest first: the count that did not change, the rule
  // applied the wrong way, and one either side.
  const candidates = [bottomFrom, bottomFrom - delta, answer + 1, answer - 1, answer + 2];
  const seen = new Set([answer]);
  const distractors: string[] = [];
  for (const n of candidates) {
    if (n < 1 || n > MAX_SET || seen.has(n)) continue;
    seen.add(n);
    distractors.push(countCardSvg(bottomPicture, n));
  }

  const move = delta > 0 ? `${delta} more` : `${-delta} fewer`;
  return figureChoice(rng, {
    instructions: "Work out what happens in the top row, then do the same in the bottom row.",
    stem: "How many belong in the empty box?",
    figure: countAnalogySvg(
      { picture: topPicture, from: topFrom, to: topFrom + delta },
      { picture: bottomPicture, from: bottomFrom },
    ),
    answerFigure: countCardSvg(bottomPicture, answer),
    distractorFigures: distractors,
    options: optionsFor(level),
    explanation: `The top row goes from ${topFrom} to ${topFrom + delta} — ${move}. Doing the same to ${bottomFrom} gives ${answer}.`,
    hint: "Count the first box, then the second. How many were added or taken away?",
  });
};

/**
 * Number puzzles, as the train activity.
 *
 * Two trains have to carry the same number of things, and one car has not been
 * loaded yet. That is an equation -- a + b = c + ? -- with nothing to read:
 * the child counts dots and evens up the load, which is the reasoning the
 * written form tests once they can read it.
 */
const numberPuzzles: GeneratorFn = (rng, level) => {
  /** The most a single car can hold and still be countable at a glance. */
  const CAR_MAX = 9;

  const total = level <= 1 ? rng.int(3, 6) : level === 2 ? rng.int(4, 9) : level === 3 ? rng.int(6, 12) : rng.int(8, 14);
  // Higher tiers spread the load over more cars, so the total has to be
  // assembled before it can be matched.
  const topCars = level >= 3 ? 3 : 2;
  const bottomKnown = level >= 4 ? 2 : 1;

  const top = split(rng, total, topCars, CAR_MAX);
  // The answer is bounded from both ends: at least one dot goes in the empty
  // car, and never so few that the cars already loaded would have to hold more
  // than a child can count.
  const answer = rng.int(Math.max(1, total - bottomKnown * CAR_MAX), Math.min(CAR_MAX, total - bottomKnown));
  const known = split(rng, total - answer, bottomKnown, CAR_MAX);

  const bottom: (number | null)[] = [...known, null];
  // Which car is empty varies, so the answer is not always the last thing read.
  if (level >= 3 && rng.bool(0.4)) bottom.reverse();

  const carried = known.reduce((a, b) => a + b, 0);
  return choice(rng, {
    instructions: "Both trains must carry the same number.",
    stem: "How many dots go in the empty car?",
    figure: trainsSvg(top, bottom),
    answer: `${answer}`,
    distractors: nearby(rng, answer, Math.max(3, Math.ceil(total / 3))),
    explanation: `The first train carries ${top.join(" + ")} = ${total}. The second already carries ${known.join(" + ")}${known.length > 1 ? ` = ${carried}` : ""}, so the empty car needs ${answer} more to make ${total}.`,
    hint: "Count the whole first train. Then count what the second train already has.",
  });
};

/**
 * `total` split into `parts` car loads, each between 1 and `max`.
 *
 * Every car carries something -- an empty car in the middle of a loaded train
 * would read as a second question -- so each starts at one and the remainder
 * is dealt out at random.
 */
function split(rng: Rng, total: number, parts: number, max: number): number[] {
  const out = Array.from({ length: parts }, () => 1);
  let left = total - parts;
  for (let guard = 0; left > 0 && guard < 400; guard++) {
    const i = rng.int(0, parts - 1);
    if (out[i] < max) {
      out[i]++;
      left--;
    }
  }
  return out;
}

/**
 * Number series, as the abacus activity.
 *
 * Each rod holds one more (or one fewer) bead than the last, and the child
 * picks the rod that comes next. Bead counts stay at ten or under: a rod a
 * first grader cannot count is not a harder reasoning item, only a harder
 * counting one.
 */
const numberSeries: GeneratorFn = (rng, level) => {
  const MAX_BEADS = 10;
  // How many rods stand before the empty one. A rod holds ten beads at most,
  // so every extra rod costs reach: with three rods a series can climb in
  // twos, with four it mostly climbs in ones. Varying it is what keeps the
  // tier from serving the same handful of series -- (start, step) alone gives
  // only about a dozen that fit on the frame.
  const shown = level <= 2 ? 3 : rng.pick([3, 4]);

  if (level >= 4 && rng.bool(0.45)) {
    // A repeating pattern rather than a growing one.
    const a = rng.int(1, 7);
    const b = rng.intExcept(1, 8, [a]);
    const rods = [a, b, a, b];
    return abacusChoice(rng, {
      rods,
      answer: a,
      distractors: [b, a + 1, Math.max(1, a - 1), b + 1],
      explanation: `The rods keep repeating ${a} and ${b}. After ${a}, ${b}, ${a}, ${b} the next rod goes back to ${a}.`,
      hint: "Look for two rods that keep taking turns.",
      level,
    });
  }

  const steps =
    level <= 1 ? [1, 2] : level === 2 ? [1, 2, -1] : level === 3 ? [1, 2, 3, -1, -2] : [2, 3, -2, -3];
  // A step only fits if the whole series, answer included, stays on the frame:
  // four rods climbing in threes would reach thirteen beads.
  const reach = Math.floor((MAX_BEADS - 1) / shown);
  const fitting = steps.filter((st) => Math.abs(st) <= reach);
  const step = rng.pick(fitting.length ? fitting : [Math.sign(rng.pick(steps)) || 1]);
  // Every rod in the series, the answer included, has to fit on the frame.
  const start =
    step > 0
      ? rng.int(1, MAX_BEADS - step * shown)
      : rng.int(1 - step * shown, MAX_BEADS);
  const rods = Array.from({ length: shown }, (_, i) => start + step * i);
  const answer = start + step * shown;

  return abacusChoice(rng, {
    rods,
    answer,
    distractors: [answer + 1, answer - 1, answer + step, rods[2]],
    explanation: `Each rod has ${step > 0 ? `${step} more` : `${-step} fewer`} bead${Math.abs(step) === 1 ? "" : "s"} than the one before: ${rods.join(", ")}. So the next rod has ${answer}.`,
    hint: "Count the first rod, then the second. How many were added?",
    level,
  });
};

/** An abacus item: the prompt rods plus one rod per answer option. */
function abacusChoice(
  rng: Rng,
  q: { rods: number[]; answer: number; distractors: number[]; explanation: string; hint: string; level: number },
): ReturnType<GeneratorFn> {
  const options = q.distractors.filter((n) => n >= 1 && n <= 10 && n !== q.answer);
  return figureChoice(rng, {
    instructions: "Find the rod that comes next.",
    stem: "Which rod belongs where the **?** is?",
    figure: abacusSvg([...q.rods, null]),
    answerFigure: abacusSvg([q.answer]),
    distractorFigures: options.map((n) => abacusSvg([n])),
    options: optionsFor(q.level),
    explanation: q.explanation,
    hint: q.hint,
  });
}

/* -------------------------------------------------------------- nonverbal */

function randomFig(rng: Rng): Fig {
  return {
    shape: rng.pick(SHAPES),
    shading: rng.pick(SHADINGS),
    size: rng.pick([1, 2] as const),
    count: rng.pick([1, 2, 3] as const),
  };
}

/** One step along an attribute, used as a matrix rule. */
type Step = { attr: Attribute; from: Fig; to: (f: Fig) => Fig; words: string };

function stepFor(rng: Rng, attr: Attribute, base: Fig): Step | null {
  switch (attr) {
    case "shading": {
      const order: Shading[] = ["open", "shaded", "solid"];
      const i = order.indexOf(base.shading);
      if (i === order.length - 1) return null;
      return {
        attr,
        from: base,
        // Saturating, not wrapping: the rule is applied a second time to build
        // a distractor, and a third shading step past "solid" has nowhere to
        // go. Returning the figure unchanged makes that distractor a duplicate
        // of the answer, which the caller drops.
        to: (f) => ({ ...f, shading: order[Math.min(order.indexOf(f.shading) + 1, order.length - 1)] }),
        words: "the shape gets darker",
      };
    }
    case "size": {
      if (base.size !== 1) return null;
      return { attr, from: base, to: (f) => ({ ...f, size: 2 }), words: "the shape gets bigger" };
    }
    case "count": {
      if (base.count > 2) return null;
      return {
        attr,
        from: base,
        to: (f) => ({ ...f, count: Math.min(3, f.count + 1) as 1 | 2 | 3 }),
        words: "one more shape is added",
      };
    }
    case "shape": {
      const target = rng.pick(SHAPES.filter((s) => s !== base.shape));
      return { attr, from: base, to: (f) => ({ ...f, shape: target }), words: `the shape becomes a ${target}` };
    }
  }
}

/**
 * Figure analogies: the rule shown in the first pair, applied to the second.
 * The second pair has to start from a figure the rule can actually act on --
 * a "gets bigger" rule needs a small figure to grow.
 */
const figureAnalogies: GeneratorFn = (rng, level) => {
  const attrs: Attribute[] =
    level <= 1 ? ["shading", "count"] : level === 2 ? ["shading", "count", "size"] : ["shading", "count", "size", "shape"];

  // A rule needs room to act: "gets darker" cannot apply to a solid figure and
  // "gets bigger" cannot apply to a large one, so the base figure and the rule
  // are drawn together until they fit.
  let a = randomFig(rng);
  let step: Step | null = null;
  for (let tries = 0; tries < 12 && !step; tries++) {
    a = randomFig(rng);
    step = stepFor(rng, rng.pick(attrs), a);
  }
  if (!step) {
    a = { ...a, count: 1 };
    step = stepFor(rng, "count", a)!;
  }
  const rule = step;
  const b = rule.to(a);

  // The second pair starts from a different figure the same rule can act on.
  // When the rule names a target shape, that pair must not already be that
  // shape, or the answer would be its own prompt.
  const forbidden = new Set<string>([a.shape, ...(rule.attr === "shape" ? [b.shape] : [])]);
  let c: Fig = { ...a, shape: rng.pick(SHAPES.filter((s) => !forbidden.has(s))) };
  if (level >= 3) {
    // Vary a second attribute too, but never the one the rule changes -- the
    // second pair has to be a case of the same rule, not a second rule.
    const spare = (["shading", "size", "count"] as Attribute[]).filter((x) => x !== rule.attr);
    const vary = rng.pick(spare);
    if (vary === "shading") c = { ...c, shading: rng.pick(SHADINGS.filter((sh) => sh !== a.shading)) };
    if (vary === "size") c = { ...c, size: c.size === 1 ? 2 : 1 };
    if (vary === "count") c = { ...c, count: rng.pick([1, 2, 3] as const) };
  }
  // "Gets bigger" and "one more" both have a ceiling; re-floor the second pair
  // so the rule still has somewhere to go.
  if (rule.attr === "size") c = { ...c, size: 1 };
  if (rule.attr === "count") c = { ...c, count: Math.min(c.count, 2) as 1 | 2 };

  const answer = rule.to(c);

  const candidates: Fig[] = [
    c, // the rule was never applied
    rule.to(answer), // the rule was applied twice
    { ...answer, shape: rng.pick(SHAPES.filter((sh) => sh !== answer.shape)) },
    { ...answer, count: rng.pick(([1, 2, 3] as const).filter((n) => n !== answer.count)) },
    { ...answer, shading: rng.pick(SHADINGS.filter((sh) => sh !== answer.shading)) },
    { ...answer, size: answer.size === 1 ? 2 : 1 },
  ];
  const seen = new Set([figKey(answer)]);
  const distractors: string[] = [];
  for (const f of candidates) {
    if (seen.has(figKey(f))) continue;
    seen.add(figKey(f));
    distractors.push(figSvg(f));
  }

  return figureChoice(rng, {
    instructions: "Work out what changed in the first pair, then do the same to the next one.",
    stem: "Which picture belongs where the **?** is?",
    figure: analogyRowSvg(a, b, c),
    options: optionsFor(level),
    answerFigure: figSvg(answer),
    distractorFigures: distractors,
    explanation: `In the first pair, ${rule.words}: ${describe(a)} becomes ${describe(b)}. Doing the same to ${describe(c)} gives ${describe(answer)}.`,
    hint: "Ask what changed from the first picture to the second — and what stayed the same.",
  });
};

/**
 * Figure classification. Three figures share exactly one attribute; the others
 * are deliberately varied, because a second thing held constant by accident
 * makes more than one answer defensible.
 */
const figureClassification: GeneratorFn = (rng, level) => {
  const key: Attribute = level <= 1 ? "shape" : level === 2 ? "count" : level === 3 ? "shading" : rng.pick(["shading", "size", "shape"] as Attribute[]);

  const sharedShape = rng.pick(SHAPES);
  const sharedShading = rng.pick(SHADINGS);
  const sharedSize = rng.pick([1, 2] as const);
  const sharedCount = rng.pick([1, 2, 3] as const);

  const shapeCycle = rng.shuffle([...SHAPES]);
  const shadingCycle = rng.shuffle([...SHADINGS]);
  const countCycle = rng.shuffle([1, 2, 3] as (1 | 2 | 3)[]);

  /** A figure that shares the key attribute, varying everything else. */
  const member = (i: number): Fig => ({
    shape: key === "shape" ? sharedShape : shapeCycle[i % shapeCycle.length],
    shading: key === "shading" ? sharedShading : shadingCycle[i % shadingCycle.length],
    size: key === "size" ? sharedSize : ((i % 2 === 0 ? 1 : 2) as 1 | 2),
    count: key === "count" ? sharedCount : countCycle[i % countCycle.length],
  });

  const group = [member(0), member(1), member(2)];
  let answer = member(3);
  for (let i = 4; group.some((g) => figKey(g) === figKey(answer)) && i < 12; i++) answer = member(i);

  /** A figure that breaks the rule, so it cannot belong. */
  const outsider = (i: number): Fig => {
    const f = member(i);
    switch (key) {
      case "shape":
        return { ...f, shape: rng.pick(SHAPES.filter((s) => s !== sharedShape)) };
      case "shading":
        return { ...f, shading: rng.pick(SHADINGS.filter((s) => s !== sharedShading)) };
      case "size":
        return { ...f, size: (sharedSize === 1 ? 2 : 1) as 1 | 2 };
      case "count":
        return { ...f, count: rng.pick(([1, 2, 3] as const).filter((n) => n !== sharedCount)) };
    }
  };

  const seen = new Set([figKey(answer)]);
  const distractors: string[] = [];
  for (let i = 0; i < 10 && distractors.length < 3; i++) {
    const f = outsider(i);
    if (seen.has(figKey(f))) continue;
    seen.add(figKey(f));
    distractors.push(figSvg(f));
  }

  const rule: Record<Attribute, string> = {
    shape: `they are all ${sharedShape}s`,
    shading: `they are all ${sharedShading}`,
    size: `they are all the ${sharedSize === 1 ? "small" : "large"} size`,
    count: `there are always ${sharedCount} of them`,
  };

  return figureChoice(rng, {
    instructions: "Find what the three pictures have in common.",
    stem: "Which picture belongs with these three?",
    figure: figRowSvg(group),
    options: optionsFor(level),
    answerFigure: figSvg(answer),
    distractorFigures: distractors,
    explanation: `The three pictures are alike in one way: ${rule[key]}. Only ${describe(answer)} is like them in that way.`,
    hint: "Check one thing at a time: the shape, how many, how dark, how big.",
  });
};

/** Paper folding: punch through folded paper, then picture it opened out. */
const paperFolding: GeneratorFn = (rng, level) => {
  const fold: Fold = level <= 1 ? "vertical" : rng.pick(["vertical", "horizontal"] as Fold[]);
  const holeCount = level <= 2 ? 1 : 2;

  const slots = rng.shuffle(foldedSlots(fold));
  const holes: Hole[] = slots.slice(0, holeCount);
  const answer = unfoldHoles(holes, fold);

  const otherAxis: Fold = fold === "vertical" ? "horizontal" : "vertical";
  const candidates: Hole[][] = [
    holes, // forgot that the punch goes through both halves
    unfoldHoles(holes, otherAxis), // mirrored the wrong way
    answer.filter((h) => !holes.some((o) => o.col === h.col && o.row === h.row)), // kept only the new holes
    unfoldHoles(unfoldHoles(holes, fold), otherAxis), // mirrored twice
  ];

  const seen = new Set([holesKey(answer)]);
  const distractors: string[] = [];
  for (const c of candidates) {
    const k = holesKey(c);
    if (!c.length || seen.has(k)) continue;
    seen.add(k);
    distractors.push(unfoldedSvg(c, fold));
  }

  return figureChoice(rng, {
    instructions: "The paper is folded, then holes are punched through it.",
    stem: `This sheet was folded ${fold === "vertical" ? "left over right" : "top over bottom"} and ${holeCount === 1 ? "a hole was" : "two holes were"} punched through it.\n\nWhat does the paper look like when it is opened up?`,
    figure: foldedSvg(fold, holes),
    options: optionsFor(level),
    answerFigure: unfoldedSvg(answer, fold),
    distractorFigures: distractors,
    explanation: `The punch goes through both layers, so every hole appears twice: once where it was punched and once on the other side of the fold. ${holeCount === 1 ? "One hole" : "Two holes"} punched through two layers makes ${answer.length} holes in all.`,
    hint: "Imagine the paper opening like a door. Each hole gets a partner on the other side of the crease.",
  });
};

export const cogatGenerators: Record<string, GeneratorFn> = {
  "cogat-picture-analogies": pictureAnalogies,
  "cogat-picture-groups": pictureGroups,
  "cogat-sentence-completion": sentenceCompletion,
  "cogat-number-analogies": numberAnalogies,
  "cogat-number-puzzles": numberPuzzles,
  "cogat-number-series": numberSeries,
  "cogat-figure-analogies": figureAnalogies,
  "cogat-figure-classification": figureClassification,
  "cogat-paper-folding": paperFolding,
};
