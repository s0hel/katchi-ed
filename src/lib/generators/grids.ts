import { describe, figElements, sizedInCells, type Fig } from "./shapes";

/**
 * The drawing kit behind the NGAT: grids, cut-out patterns, and numerals.
 *
 * The Naglieri tests are matrix tests. Where CogAT prints an analogy as two
 * rows joined by an arrow -- because a six-year-old needs to be told which way
 * the rule runs -- the NGAT prints a grid and leaves the reader to find the
 * direction, which is part of what it is measuring. So none of these draw an
 * arrow, and the missing cell is a `?` in the grid rather than a box at the
 * end of a sentence.
 *
 * Everything here obeys `shapes.ts`'s one rule: a figure and the options that
 * answer it are measured in the same cell, so a question about size can be
 * read across the two panels. A cut-out patch is the one place that matters
 * twice over -- the patch has to render at exactly the size of the hole it
 * fills, or a child is comparing two drawings at different scales.
 *
 * The one piece of text the NGAT lets a reader meet is a numeral, which is why
 * the quantitative figures at the bottom of this file may draw digits and
 * nothing above them may.
 */

const STROKE = "var(--kx-fig-stroke)";

/** The cell every figure in a matrix item is drawn in, question and answers. */
export const MATRIX_CELL = 72;

/**
 * A cell's outline, drawn inset rather than in a gutter.
 *
 * Nothing here is allowed to add width between cells, because the prompt panel
 * stops at three cells (`max-w-sm` against `--kx-fig-cell`) and anything wider
 * is scaled down -- which would leave the question drawn smaller than the
 * options answering it. Three boxes edge to edge, each inset by three, is
 * exactly three cells and still reads as three boxes.
 */
const box = (x: number, y: number, side: number, dashed = false) =>
  `<rect x="${x + 3}" y="${y + 3}" width="${side - 6}" height="${side - 6}" rx="6" fill="none"
    stroke="${STROKE}" stroke-width="1.5" opacity="${dashed ? 0.75 : 0.5}"
    ${dashed ? 'stroke-dasharray="5 4"' : ""}/>`;

const missing = (x: number, y: number, side: number) =>
  `<text x="${x + side / 2}" y="${y + side / 2 + 10}" text-anchor="middle"
    font-size="28" font-weight="700" fill="${STROKE}">?</text>`;

/**
 * A grid of figures with one cell left empty.
 *
 * One renderer for every matrix shape the test uses: a 2x2 analogy, a 2x3
 * series, a 3x3 progression. They are the same question in different numbers
 * of boxes, and drawing them three ways would let them drift out of scale with
 * each other -- and out of scale with the options, which are one cell each.
 */
export function matrixSvg(rows: (Fig | null)[][], unit: number): string {
  const cols = Math.max(...rows.map((r) => r.length));
  const cell = MATRIX_CELL;
  const W = cols * cell;
  const H = rows.length * cell;

  const cells = rows
    .flatMap((row, r) =>
      row.map((f, c) => {
        const x = c * cell;
        const y = r * cell;
        return (
          box(x, y, cell, f === null) +
          (f ? figElements(f, x + cell / 2, y + cell / 2, unit) : missing(x, y, cell))
        );
      }),
    )
    .join("");

  const say = (row: (Fig | null)[]) =>
    row.map((f) => (f ? describe(f) : "a missing figure")).join(", then ");
  const label =
    rows.length === 1
      ? say(rows[0])
      : rows.map((row, i) => `Row ${i + 1}: ${say(row)}`).join(". ");

  return `<svg viewBox="0 0 ${W} ${H}" ${sizedInCells(W, cell)} role="img" aria-label="${label}.">
    ${cells}
  </svg>`;
}

/* --------------------------------------------------------- cut-out patterns */

/**
 * A pattern completion design: families of parallel lines across a square.
 *
 * A family is every line at one angle, evenly spaced -- so the whole design is
 * decided by four numbers, and so is every wrong option. That is the point of
 * building it this way rather than drawing a picture and cutting a hole in it:
 * the right patch is the design seen through the hole, and each wrong patch is
 * the *same* renderer with one number moved. A child rules one out by noticing
 * that its lines do not meet the ones around the hole, which is the reasoning
 * the item is for -- not by noticing that it was drawn worse.
 *
 * `dashed` stands in for the colour the real test uses. These figures are
 * monochrome so that they print, and a dashed line is the one other thing a
 * line can be without leaving black and white.
 */
export interface Family {
  /** Degrees clockwise from vertical: 0 draws vertical lines, 90 horizontal. */
  angle: 0 | 45 | 90 | 135;
  /** Gap between neighbouring lines, in design units. */
  spacing: number;
  /** How far the family is shifted along its own normal, in design units. */
  phase: number;
  dashed?: boolean;
}

export interface Design {
  families: Family[];
}

/** A square window onto a design, in patch-sized steps from the top left. */
export interface Window {
  col: number;
  row: number;
}

/** The design square is exactly three patches across, so a hole is a ninth. */
export const PATCH = 58;
const DESIGN = PATCH * 3;

const familyKey = (f: Family) => `${f.angle}:${f.spacing}:${f.phase}:${f.dashed ? "d" : "-"}`;

/** Two designs that draw the same lines. Used to drop a pointless distractor. */
export const designKey = (d: Design): string =>
  d.families.map(familyKey).sort().join("|");

/** The rectangle a set of lines is drawn into, in design units. */
interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const WHOLE: Bounds = { x0: 0, y0: 0, x1: DESIGN, y1: DESIGN };

const windowBounds = (w: Window): Bounds => ({
  x0: w.col * PATCH,
  y0: w.row * PATCH,
  x1: (w.col + 1) * PATCH,
  y1: (w.row + 1) * PATCH,
});

/**
 * The lines a family draws inside `bounds`, and only those.
 *
 * A patch emits nothing that falls outside its own window, which matters more
 * than it sounds: the rendered SVG is what tells two answer options apart, so
 * a line drawn beyond the crop would make two identical-looking patches count
 * as different and put the same picture on the board twice.
 */
function lines(f: Family, bounds: Bounds): string {
  const rad = ((f.angle - 90) * Math.PI) / 180;
  // The direction a line runs, and the direction the family steps in.
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const nx = -dy;
  const ny = dx;
  // How far along the family's own normal the rectangle reaches.
  const mid = DESIGN / 2;
  const corners = [
    [bounds.x0, bounds.y0], [bounds.x1, bounds.y0],
    [bounds.x0, bounds.y1], [bounds.x1, bounds.y1],
  ].map(([x, y]) => nx * (x - mid) + ny * (y - mid));
  const lo = Math.min(...corners);
  const hi = Math.max(...corners);
  // Long enough to cross the square from any offset, so no line stops short
  // inside the drawing and reads as a mark of its own.
  const reach = DESIGN * 1.5;

  const out: string[] = [];
  const first = Math.ceil((lo - f.phase) / f.spacing);
  const last = Math.floor((hi - f.phase) / f.spacing);
  for (let k = first; k <= last; k++) {
    const d = k * f.spacing + f.phase;
    const cx = mid + nx * d;
    const cy = mid + ny * d;
    out.push(
      `<line x1="${(cx - dx * reach).toFixed(1)}" y1="${(cy - dy * reach).toFixed(1)}"
        x2="${(cx + dx * reach).toFixed(1)}" y2="${(cy + dy * reach).toFixed(1)}"
        stroke="${STROKE}" stroke-width="2.5" stroke-linecap="round"
        ${f.dashed ? 'stroke-dasharray="7 6"' : ""}/>`,
    );
  }
  return out.join("");
}

const drawDesign = (d: Design, bounds: Bounds) =>
  d.families.map((f) => lines(f, bounds)).join("");

/** The four rectangles of the design square that the window does not cover. */
function around(w: Window): string {
  const x = w.col * PATCH;
  const y = w.row * PATCH;
  const rect = (rx: number, ry: number, rw: number, rh: number) =>
    rw > 0 && rh > 0 ? `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}"/>` : "";
  return [
    rect(0, 0, DESIGN, y),
    rect(0, y + PATCH, DESIGN, DESIGN - y - PATCH),
    rect(0, y, x, PATCH),
    rect(x + PATCH, y, DESIGN - x - PATCH, PATCH),
  ].join("");
}

/**
 * The design with one patch cut out of it.
 *
 * The lines are clipped to the paper *around* the hole rather than painted
 * over inside it. Covering them would need an opaque fill, and the one colour
 * guaranteed to be opaque in the light theme, the dark theme and on paper is
 * not the same colour in all three -- so the hole is a hole, not a patch of
 * background.
 */
export function cutoutSvg(design: Design, w: Window): string {
  // Named for the hole rather than the pattern: the clipped region depends only
  // on where the hole is, so two items on one printed sheet either want the
  // same clip path or name different ones.
  const id = `kx-cut-${w.col}-${w.row}`;
  return `<svg viewBox="0 0 ${DESIGN} ${DESIGN}" ${sizedInCells(DESIGN, PATCH)} role="img"
    aria-label="A square pattern of straight lines with one square piece missing.">
    <clipPath id="${id}">${around(w)}</clipPath>
    <g clip-path="url(#${id})">${drawDesign(design, WHOLE)}</g>
    <rect x="1" y="1" width="${DESIGN - 2}" height="${DESIGN - 2}" rx="3"
      fill="none" stroke="${STROKE}" stroke-width="2"/>
    ${box(w.col * PATCH, w.row * PATCH, PATCH, true)}
  </svg>`;
}

/**
 * One answer option: a design seen through the window.
 *
 * Cropped by the viewBox rather than by a clip path, so the patch is literally
 * the design at the same scale, offset to the hole -- which is what makes the
 * keyed option correct by construction instead of by a second calculation that
 * could disagree with the first.
 */
export function patchSvg(design: Design, w: Window): string {
  const x = w.col * PATCH;
  const y = w.row * PATCH;
  return `<svg viewBox="${x} ${y} ${PATCH} ${PATCH}" ${sizedInCells(PATCH, PATCH)} role="img"
    aria-label="A square piece of a lined pattern.">
    ${drawDesign(design, windowBounds(w))}
    <rect x="${x + 1}" y="${y + 1}" width="${PATCH - 2}" height="${PATCH - 2}"
      fill="none" stroke="${STROKE}" stroke-width="1.5" opacity="0.5"/>
  </svg>`;
}

/* ------------------------------------------------------------- numerals */

/**
 * Numbers in boxes.
 *
 * The one thing the NGAT asks a reader to read. Its instructions are animated
 * and wordless and its verbal test is pictures, precisely so that nothing but
 * a numeral stands between a child and the reasoning -- so the quantitative
 * items are numerals in boxes, laid out like the figure items above them, and
 * never a sentence about numerals.
 */
const NUM_W = 58;
const NUM_H = 50;

function numberCell(value: number | null, x: number, y: number): string {
  const inner =
    value === null
      ? `<text x="${x + NUM_W / 2}" y="${y + NUM_H / 2 + 10}" text-anchor="middle"
          font-size="27" font-weight="700" fill="${STROKE}">?</text>`
      : `<text x="${x + NUM_W / 2}" y="${y + NUM_H / 2 + 9}" text-anchor="middle"
          font-size="25" font-weight="600" fill="${STROKE}">${value}</text>`;
  return `<rect x="${x}" y="${y}" width="${NUM_W}" height="${NUM_H}" rx="6" fill="none"
    stroke="${STROKE}" stroke-width="1.5" opacity="${value === null ? 0.75 : 0.5}"
    ${value === null ? 'stroke-dasharray="5 4"' : ""}/>${inner}`;
}

const sayNumbers = (row: (number | null)[]) =>
  row.map((n) => (n === null ? "a missing number" : `${n}`)).join(", ");

/** A row or grid of numbers, one of them missing. */
export function numberGridSvg(rows: (number | null)[][]): string {
  const gap = 8;
  const cols = Math.max(...rows.map((r) => r.length));
  const W = cols * NUM_W + (cols - 1) * gap;
  const H = rows.length * NUM_H + (rows.length - 1) * gap;
  const cells = rows
    .flatMap((row, r) => row.map((n, c) => numberCell(n, c * (NUM_W + gap), r * (NUM_H + gap))))
    .join("");
  const label =
    rows.length === 1
      ? sayNumbers(rows[0])
      : rows.map((row, i) => `Row ${i + 1}: ${sayNumbers(row)}`).join(". ");
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}.">${cells}</svg>`;
}

/* ----------------------------------------------------------- dot arrays */

/**
 * A number of dots, laid out in rows of a given width.
 *
 * The item this serves shows one arrangement and asks which option holds the
 * same number in a different one -- twelve as two rows of six against three
 * rows of four. Two things follow. The dot is the same size in every option,
 * because a dot drawn to fill its box would shrink as the count grew and turn
 * the question into "which picture is darkest". And the rows are the layout
 * rather than a rectangle, so every total has several arrangements instead of
 * only the ones that factorise.
 */
const DOT_CELL = 88;
const DOT_STEP = 13;
const DOT_R = 4.5;
/** The widest row and the most rows that stay inside one cell. */
export const DOT_PER_ROW_MAX = 6;
export const DOT_ROWS_MAX = 6;

/** Whether `total` dots in rows of `perRow` fit the box they are drawn in. */
export const dotsFit = (total: number, perRow: number): boolean =>
  perRow >= 1 && perRow <= DOT_PER_ROW_MAX && Math.ceil(total / perRow) <= DOT_ROWS_MAX;

export function dotArraySvg(total: number, perRow: number): string {
  const rows = Math.ceil(total / perRow);
  const dots: string[] = [];
  for (let i = 0; i < total; i++) {
    const row = Math.floor(i / perRow);
    // The last row is centred under the full ones rather than left-aligned, so
    // a short row reads as "the rest of them" and not as a column of its own.
    const inRow = Math.min(perRow, total - row * perRow);
    const col = i % perRow;
    const cx = DOT_CELL / 2 + (col - (inRow - 1) / 2) * DOT_STEP;
    const cy = DOT_CELL / 2 + (row - (rows - 1) / 2) * DOT_STEP;
    dots.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${DOT_R}" fill="${STROKE}"/>`);
  }
  const shape = total % perRow === 0 ? `${rows} row${rows === 1 ? "" : "s"} of ${perRow}` : `rows of ${perRow}`;
  return `<svg viewBox="0 0 ${DOT_CELL} ${DOT_CELL}" ${sizedInCells(DOT_CELL, DOT_CELL)} role="img"
    aria-label="${total} dot${total === 1 ? "" : "s"}, in ${shape}.">
    ${box(0, 0, DOT_CELL)}${dots.join("")}
  </svg>`;
}
