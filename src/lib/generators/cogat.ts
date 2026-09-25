import { choice, figureChoice, nearMisses, type GeneratorFn } from "./helpers";
import { COGAT_BANKS, pool } from "./exam-banks";
import {
  GRID_CELL, ROW_CELL, SHADINGS,
  analogyGridSvg, cellRoom, describe, figLook, figRowSvg, figSvg, fitUnit, foldedSlots,
  foldedSvg, holesKey, sameLook, unfoldHoles, unfoldedSvg,
  type Fig, type Fold, type Hole, type ShapeName,
} from "./shapes";
import {
  DARKER, FALLBACK, KINSHIPS, LIGHTER, RULE_MAKERS,
  ambiguous, anyShape, plural, soundGroup, turnBy, unlike,
} from "./figure-rules";
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
    options: OPTIONS,
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
    options: OPTIONS,
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
    options: OPTIONS,
    explanation: item.why,
    hint: "Say the whole sentence out loud with each picture in the blank. Only one of them makes sense.",
  });
};

/**
 * How many options a CogAT item offers: four, everywhere, at every level.
 *
 * The lower tiers used to offer three, on the reasoning that an item with
 * nothing to read is mostly about how many pictures a child can hold in mind
 * at once. That is true, and it is exactly why three is the wrong number to
 * practise on: holding four in mind is part of what the real form asks, and a
 * child who has only ever chosen from three meets a wider board on the day.
 * The ramp has to come from the items themselves -- the bank slice each level
 * draws from, and the rules each level allows -- not from hiding an option.
 *
 * Every generator below is expected to supply three distinct distractors at
 * every level; `cogat-options.test.ts` fails if one cannot.
 */
const OPTIONS = 4;

/* ----------------------------------------------------------- quantitative */

/**
 * Wrong options near a right answer. A first grader has not met negative
 * numbers, so an option below zero is not a distractor -- it is a giveaway.
 *
 * `nearMisses` draws at random inside the spread, so on a narrow spread it can
 * come back with the same miss twice or with nothing but negatives. Whatever
 * it leaves short is topped up from the answer's own neighbours, because three
 * options is one short of what the test offers.
 */
function nearby(rng: Rng, answer: number, spread: number): string[] {
  const out = nearMisses(rng, answer, spread, 5).map(Number).filter((v) => v >= 0);
  for (let d = 1; out.length < 3; d++) {
    for (const v of [answer + d, answer - d]) {
      if (v >= 0 && v !== answer && !out.includes(v) && out.length < 3) out.push(v);
    }
  }
  return out.slice(0, 3).map(String);
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
  const offer = (n: number) => {
    if (n < 1 || n > MAX_SET || seen.has(n)) return;
    seen.add(n);
    distractors.push(countCardSvg(bottomPicture, n));
  };
  for (const n of candidates) offer(n);
  // Those five collapse into two when the rule is small -- with a step of one,
  // "the rule run backwards" and "one fewer than the answer" are the same
  // count -- so top up from the rest of the range, nearest first.
  for (let d = 1; distractors.length < 3 && d <= MAX_SET; d++) {
    offer(answer + d);
    offer(answer - d);
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
    options: OPTIONS,
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
  });
};

/** An abacus item: the prompt rods plus one rod per answer option. */
function abacusChoice(
  rng: Rng,
  q: { rods: number[]; answer: number; distractors: number[]; explanation: string; hint: string },
): ReturnType<GeneratorFn> {
  const options: number[] = [];
  const offer = (n: number) => {
    if (n >= 1 && n <= 10 && n !== q.answer && !options.includes(n)) options.push(n);
  };
  for (const n of q.distractors) offer(n);
  // A step of one makes "one more than the answer" and "the rule applied
  // again" the same rod, so top up from the answer's neighbours.
  for (let d = 1; options.length < 3 && d <= 10; d++) {
    offer(q.answer + d);
    offer(q.answer - d);
  }
  return figureChoice(rng, {
    instructions: "Find the rod that comes next.",
    stem: "Which rod belongs where the **?** is?",
    figure: abacusSvg([...q.rods, null]),
    answerFigure: abacusSvg([q.answer]),
    distractorFigures: options.map((n) => abacusSvg([n])),
    options: OPTIONS,
    explanation: q.explanation,
    hint: q.hint,
  });
}

/* -------------------------------------------------------------- nonverbal */

/**
 * Figure analogies: the rule shown in the first pair, applied to the second.
 *
 * The two pairs are drawn and compared by what they *look* like, not by what
 * their attributes say. A rule has to visibly change the first pair, visibly
 * change the second, and the second pair has to land somewhere the first did
 * not -- otherwise "copy the box above" answers the item without the rule.
 */
const figureAnalogies: GeneratorFn = (rng, level) => {
  const makers = RULE_MAKERS.filter((m) => m.tier <= level);

  let rule = FALLBACK;
  let a = rule.start(rng);
  let b = rule.to(a);
  let c = { ...a, shape: rng.pick(unlike(a.shape)) };
  let answer = rule.to(c);

  // A rule is chosen once and then given several goes at producing an item.
  // Picking again on every failed draw would quietly bias the whole skill
  // towards the rules with the loosest requirements: the ones that have to
  // start from a particular kind of figure fail a draw more often, and would
  // come up a fraction as often as the ones that will act on anything.
  outer: for (let pick = 0; pick < 14; pick++) {
    const maker = rng.pick(makers);
    const still = maker.id === "same";
    for (let draw = 0; draw < 6; draw++) {
      const r = maker.make(rng);
      const x = r.start(rng);
      const y = r.to(x);
      if (!still && sameLook(x, y)) continue;
      const z = r.start(rng);
      // The second pair has to be its own figure, and it has to go somewhere.
      if (sameLook(z, x) || (!still && sameLook(z, r.to(z))) || sameLook(r.to(z), y)) continue;
      if (ambiguous(rng, r, x, y, z, r.to(z))) continue;
      rule = r;
      a = x;
      b = y;
      c = z;
      answer = r.to(z);
      break outer;
    }
  }

  const seen = new Set([figLook(answer)]);
  const wrong: Fig[] = [];
  const offer = (f: Fig) => {
    const k = figLook(f);
    if (wrong.length >= 4 || seen.has(k)) return;
    seen.add(k);
    wrong.push(f);
  };

  offer(c); // the rule was never applied
  offer(b); // the answer was copied from the row above
  offer(rule.to(answer)); // the rule was applied twice
  // What the other rules would have made of the same figure: a wrong answer a
  // child can talk themselves into beats one they can see is off.
  for (const m of rng.shuffle([...makers])) offer(m.make(rng).to(c));
  // Last resort, so the item always has four options to offer.
  offer({ ...answer, shading: DARKER[answer.shading] });
  offer({ ...answer, shading: LIGHTER[answer.shading] });
  offer({ ...answer, shape: rng.pick(unlike(answer.shape)) });
  offer({ ...answer, size: answer.size === 1 ? 2 : 1 });
  offer(turnBy(answer, 1));

  // One unit for the whole question, question and answers together, so that
  // "the shape gets bigger" is still bigger once it is the answer.
  const unit = fitUnit([a, b, c, answer, ...wrong], cellRoom(GRID_CELL));

  return figureChoice(rng, {
    instructions: "Work out what changed in the first pair, then do the same to the next one.",
    stem: "Which picture belongs where the **?** is?",
    figure: analogyGridSvg(a, b, c, unit),
    options: OPTIONS,
    answerFigure: figSvg(answer, unit, GRID_CELL),
    distractorFigures: wrong.map((f) => figSvg(f, unit, GRID_CELL)),
    explanation: `In the first pair, ${rule.words}: ${describe(a)} becomes ${describe(b)}. Doing the same to ${describe(c)} gives ${describe(answer)}.`,
    hint: "Ask what changed from the first picture to the second — and what stayed the same.",
  });
};


/**
 * An item that cannot fail, for when every draw above has.
 *
 * Built rather than canned, so the rare seed that falls through here still
 * gets its own question. It is sound by construction: the group is one shape
 * in three different shadings, three sizes and three counts, so shape is the
 * only thing the three agree on, and each wrong option repeats one member's
 * shading and count under a different shape.
 */
function plainGroup(rng: Rng): { words: string; group: Fig[]; answer: Fig; wrong: Fig[] } {
  const shape = anyShape(rng);
  const others = rng.shuffle(unlike(shape));
  const shadings = rng.shuffle([...SHADINGS]);
  const counts = rng.shuffle([1, 2, 3] as (1 | 2 | 3)[]);
  const at = (i: number, s: ShapeName): Fig => ({
    shape: s,
    shading: shadings[i % 3],
    size: (i % 2 === 0 ? 1 : 2) as 1 | 2,
    count: counts[i % 3],
  });
  return {
    words: `they are all ${plural(shape)}`,
    group: [at(0, shape), at(1, shape), at(2, shape)],
    answer: { ...at(0, shape), size: 2, count: counts[1] },
    wrong: [at(0, others[0]), at(1, others[1]), at(2, others[2])],
  };
}

/**
 * Figure classification: three that belong together, and a fourth that joins
 * them.
 */
const figureClassification: GeneratorFn = (rng, level) => {
  const makers = KINSHIPS.filter((k) => k.tier <= level);

  let { words, group, answer, wrong } = plainGroup(rng);

  // As in the analogies: one kinship, then several goes at it, so that the
  // rules with the fussiest figures do not end up the rarest.
  outer: for (let pick = 0; pick < 14; pick++) {
    const maker = rng.pick(makers);
    for (let draw = 0; draw < 8; draw++) {
      const kin = maker.make(rng);
      const seen = new Set<string>();
      /** `n` figures from `build`, no two of which draw the same picture. */
      const take = (build: () => Fig, n: number): Fig[] => {
        const out: Fig[] = [];
        for (let i = 0; i < 40 && out.length < n; i++) {
          const f = build();
          const look = figLook(f);
          if (seen.has(look)) continue;
          seen.add(look);
          out.push(f);
        }
        return out;
      };

      const three = take(() => kin.member(rng), 3);
      const [right] = take(() => kin.member(rng), 1);
      const others = take(() => kin.outsider(rng), 3);
      if (three.length < 3 || !right || others.length < 3) continue;
      // The rule the item states has to pick out exactly one of the four.
      if (!three.every(kin.holds) || !kin.holds(right) || others.some(kin.holds)) continue;
      if (!soundGroup(three, [right, ...others], right)) continue;

      words = kin.words;
      group = three;
      answer = right;
      wrong = others;
      break outer;
    }
  }

  // One unit across the group and the answers, so "they are all the large
  // size" is a comparison a child can actually make between the two panels.
  const unit = fitUnit([...group, answer, ...wrong], cellRoom(ROW_CELL));

  return figureChoice(rng, {
    instructions: "Find what the three pictures have in common.",
    stem: "Which picture belongs with these three?",
    figure: figRowSvg(group, unit),
    options: OPTIONS,
    answerFigure: figSvg(answer, unit, ROW_CELL),
    distractorFigures: wrong.map((f) => figSvg(f, unit, ROW_CELL)),
    explanation: `The three pictures are alike in one way: ${words}. Only ${describe(answer)} is like them in that way.`,
    hint: "Check one thing at a time: the shape, how many, how dark, how big — and what is inside.",
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
  const offer = (c: Hole[]) => {
    const k = holesKey(c);
    if (!c.length || seen.has(k) || distractors.length >= 3) return;
    seen.add(k);
    distractors.push(unfoldedSvg(c, fold));
  };
  for (const c of candidates) offer(c);

  // Those four coincide whenever the punched holes already sit symmetrically
  // about the fold, which leaves the item an option short. The top-up punches
  // one of the holes somewhere else on the folded half and unfolds that: still
  // a sheet the punch could have made, so it cannot be ruled out on sight the
  // way a lopsided pattern could.
  const elsewhere = slots.filter((s) => !holes.some((h) => h.col === s.col && h.row === s.row));
  for (const h of holes) {
    for (const s of elsewhere) {
      offer(unfoldHoles([...holes.filter((o) => o !== h), s], fold));
    }
  }

  return figureChoice(rng, {
    instructions: "The paper is folded, then holes are punched through it.",
    stem: `This sheet was folded ${fold === "vertical" ? "left over right" : "top over bottom"} and ${holeCount === 1 ? "a hole was" : "two holes were"} punched through it.\n\nWhat does the paper look like when it is opened up?`,
    figure: foldedSvg(fold, holes),
    options: OPTIONS,
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
