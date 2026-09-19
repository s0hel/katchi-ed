/**
 * Figures a child counts: the abacus and the train.
 *
 * CogAT's quantitative battery at Level 7 asks the same questions as the
 * higher levels and asks them in pictures, because a six-year-old meets the
 * arithmetic before they can read a row of symbols fluently. Number series is
 * an abacus whose rods hold a growing number of beads; number puzzles are
 * trains that have to carry the same load. Reducing either to numerals would
 * turn a quantitative-reasoning item into a reading item, which is exactly the
 * confound the picture format exists to avoid.
 *
 * Counts stay inside what a first grader can subitize or count reliably: ten
 * beads to a rod, nine dots to a car.
 */

const STROKE = "var(--kx-fig-stroke)";
const FILL = "var(--kx-fig-fill)";

/* ---------------------------------------------------------------- abacus */

/**
 * Rod geometry, set by the two things that make an abacus countable.
 *
 * Beads are spaced wider than they are round, so a stack reads as separate
 * beads rather than one long blob -- counting is the whole task here. And the
 * rod is tall enough for a full stack of ten: a rod drawn too short does not
 * overflow visibly, it silently clips beads off the top and turns a countable
 * item into an unanswerable one.
 */
const ROD_W = 44;
const ROD_H = 152;
const BEAD_R = 5;
const BEAD_STEP = 13;
export const MAX_BEADS = 10;

/** One rod, drawn from the bottom up. `null` beads mean the missing rod. */
function rod(x: number, beads: number | null): string {
  const cx = x + ROD_W / 2;
  const top = 8;
  const base = ROD_H - 14;
  const post = `<line x1="${cx}" y1="${top}" x2="${cx}" y2="${base}" stroke="${STROKE}" stroke-width="2"/>
    <line x1="${x + 6}" y1="${base}" x2="${x + ROD_W - 6}" y2="${base}" stroke="${STROKE}" stroke-width="3"/>`;

  if (beads === null) {
    return `${post}<text x="${cx}" y="${base - 46}" text-anchor="middle" font-size="30" font-weight="700" fill="${STROKE}">?</text>`;
  }

  const stack: string[] = [];
  for (let i = 0; i < Math.min(beads, MAX_BEADS); i++) {
    const cy = base - BEAD_R - 1.5 - i * BEAD_STEP;
    stack.push(`<circle cx="${cx}" cy="${cy.toFixed(1)}" r="${BEAD_R}" fill="${STROKE}"/>`);
  }
  return post + stack.join("");
}

/**
 * A row of rods. The rod whose count is `null` is the one being asked about,
 * which is how the prompt and the answer options share one drawing routine --
 * an option is a one-rod abacus at the same bead size as the prompt.
 */
export function abacusSvg(beadCounts: (number | null)[]): string {
  const label = beadCounts
    .map((n) => (n === null ? "an empty rod" : `${n} bead${n === 1 ? "" : "s"}`))
    .join(", then ");
  // A lone rod -- an answer option -- is centred in a two-rod box. Drawn in a
  // box its own width it would be scaled up to the width of the button and
  // dwarf the rods in the question it answers.
  const width = Math.max(beadCounts.length, 2) * ROD_W;
  const offset = (width - beadCounts.length * ROD_W) / 2;
  const rods = beadCounts.map((n, i) => rod(offset + i * ROD_W, n)).join("");
  return `<svg viewBox="0 0 ${width} ${ROD_H}" role="img"
    aria-label="An abacus: ${label}.">${rods}</svg>`;
}

/* ----------------------------------------------------------------- train */

const CAR_W = 62;
const CAR_H = 50;
const ENGINE_W = 46;

/** Dots inside a car, in rows of three. */
function load(x: number, y: number, count: number): string {
  const dots: string[] = [];
  const perRow = 3;
  const rows = Math.ceil(count / perRow);
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, count - row * perRow);
    const col = i % perRow;
    const cx = x + CAR_W / 2 + (col - (inRow - 1) / 2) * 15;
    const cy = y + CAR_H / 2 + (row - (rows - 1) / 2) * 14;
    dots.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5" fill="${STROKE}"/>`);
  }
  return dots.join("");
}

function wheels(x: number, y: number, width: number): string {
  const cy = y + CAR_H + 5;
  return [x + width * 0.28, x + width * 0.72]
    .map((cx) => `<circle cx="${cx.toFixed(1)}" cy="${cy}" r="5" fill="none" stroke="${STROKE}" stroke-width="2"/>`)
    .join("");
}

function engine(x: number, y: number): string {
  return `<path d="M ${x + 4} ${y + CAR_H} v -22 h 12 v -14 h 18 v 14 h 8 v 22 z"
      fill="${FILL}" stroke="${STROKE}" stroke-width="2" stroke-linejoin="round"/>
    <rect x="${x + 10}" y="${y + 6}" width="7" height="10" fill="${STROKE}"/>
    ${wheels(x, y, ENGINE_W)}`;
}

/** One train: an engine, then a car per load. `null` is the car in question. */
function train(y: number, cars: (number | null)[]): string {
  const parts = [engine(0, y)];
  cars.forEach((count, i) => {
    const x = ENGINE_W + 6 + i * (CAR_W + 6);
    parts.push(`<rect x="${x}" y="${y}" width="${CAR_W}" height="${CAR_H}" rx="5"
      fill="${count === null ? "none" : FILL}" stroke="${STROKE}" stroke-width="2"
      ${count === null ? 'stroke-dasharray="5 4"' : ""}/>`);
    parts.push(
      count === null
        ? `<text x="${x + CAR_W / 2}" y="${y + CAR_H / 2 + 11}" text-anchor="middle" font-size="28" font-weight="700" fill="${STROKE}">?</text>`
        : load(x, y, count),
    );
    parts.push(wheels(x, y, CAR_W));
  });
  return parts.join("");
}

function describeTrain(cars: (number | null)[]): string {
  return cars.map((n) => (n === null ? "an empty car" : `a car with ${n}`)).join(" and ");
}

/**
 * Two trains, one above the other. The puzzle is always the same: both trains
 * must carry the same number, and one car has not been loaded yet.
 */
export function trainsSvg(top: (number | null)[], bottom: (number | null)[]): string {
  const width = ENGINE_W + 6 + Math.max(top.length, bottom.length) * (CAR_W + 6);
  const rowH = CAR_H + 22;
  return `<svg viewBox="0 0 ${width} ${rowH * 2}" role="img"
    aria-label="Two trains. The first has ${describeTrain(top)}. The second has ${describeTrain(bottom)}.">
    ${train(4, top)}
    ${train(4 + rowH, bottom)}
  </svg>`;
}
