import iconData from "../../data/picture-icons.json";

/**
 * Picture items, drawn rather than typed.
 *
 * The banks write a picture as an emoji and its word ("🧦 sock") because that
 * is what a reviewer can read in a diff. What a six-year-old sees is the
 * artwork alone, at the size of the question. The word is never drawn: CogAT
 * pictures carry no labels, and a printed word under one is a reading task
 * smuggled into an item that is meant to have none. The word still does its
 * work off-screen -- it is the accessibility label, the hint, and the wording
 * of the answer key.
 *
 * An emoji left as a text glyph would render at the font size -- far too small
 * to name at a glance -- and would render as whatever glyph the reader's
 * device happens to ship, which for a test that asks "what is this a picture
 * of?" is not a detail. The artwork is vendored into picture-icons.json by
 * scripts/build-icons.ts.
 *
 * Artwork: Twemoji, licensed CC BY 4.0. See PICTURE_CREDIT below; anywhere
 * these are shown has to carry it.
 */

const ICONS = iconData as Record<string, string>;

export const PICTURE_CREDIT = {
  text: "Picture icons by Twemoji, licensed CC BY 4.0.",
  href: "https://github.com/jdecked/twemoji",
} as const;

/** Twemoji draws everything in a 36x36 box. */
const ART = 36;

/** Generators whose questions draw these icons, so a page can credit them. */
const PICTURE_GENERATORS = new Set([
  "cogat-picture-analogies",
  "cogat-picture-groups",
  "cogat-sentence-completion",
  "cogat-number-analogies",
  "ngat-odd-one-out",
  "ngat-number-analogies",
]);

/**
 * Objects a set-size item counts.
 *
 * Which object is used carries no meaning -- the item is about how many --
 * so these are chosen for one thing only: a silhouette that stays countable
 * when six of them share a box. Anything long and thin, or busy in the middle,
 * turns a row of six into a smear.
 */
export const COUNTABLE_OBJECTS = [
  "🏀 basketball", "🖊️ pen", "🍎 apple", "⭐ star", "🎈 balloon", "🍌 banana",
  "🔑 key", "🐟 fish", "🌼 flower", "🚗 car", "📕 book", "🍪 cookie",
  "🧦 sock", "🐝 bee", "🍦 ice cream", "🪁 kite", "🐚 shell", "🧊 ice cube",
  "🦋 butterfly", "🍄 mushroom", "🥕 carrot", "🔔 bell",
];

export function usesPictureIcons(generator: string): boolean {
  return PICTURE_GENERATORS.has(generator);
}

export interface Picture {
  emoji: string;
  word: string;
}

export function parsePicture(picture: string): Picture {
  const space = picture.indexOf(" ");
  return space < 0
    ? { emoji: picture, word: picture }
    : { emoji: picture.slice(0, space), word: picture.slice(space + 1).trim() };
}

export function hasIcon(picture: string): boolean {
  return parsePicture(picture).emoji in ICONS;
}

/* ------------------------------------------------------------------ cells */

const CELL_W = 56;
const CELL_H = 56;
// With no word underneath, the artwork gets the room the caption used to take.
const ICON = 42;

/** One picture, centred in its cell. Missing artwork falls back to the glyph. */
function cell(picture: string, x: number, y: number): string {
  const { emoji } = parsePicture(picture);
  const art = ICONS[emoji];
  const ix = x + (CELL_W - ICON) / 2;
  const iy = y + (CELL_H - ICON) / 2;
  return art
    ? `<svg x="${ix}" y="${iy}" width="${ICON}" height="${ICON}" viewBox="0 0 ${ART} ${ART}">${art}</svg>`
    : `<text x="${x + CELL_W / 2}" y="${iy + ICON * 0.8}" text-anchor="middle"
        font-size="${ICON * 0.8}">${emoji}</text>`;
}

const box = (x: number, y: number) =>
  `<rect x="${x}" y="${y}" width="${CELL_W}" height="${CELL_H}" rx="6"
    fill="none" stroke="var(--kx-fig-stroke)" stroke-width="1.5" opacity="0.45"/>`;

const arrow = (x: number, y: number, span: number) =>
  `<path d="M ${x + 3} ${y} h ${span - 9} m -5 -4 l 5 4 l -5 4"
    fill="none" stroke="var(--kx-fig-stroke)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;

const question = (x: number, y: number) =>
  `<text x="${x + CELL_W / 2}" y="${y + CELL_H / 2 + 9}" text-anchor="middle"
    font-size="26" font-weight="700" fill="var(--kx-fig-stroke)">?</text>`;

const words = (p: string) => parsePicture(p).word;

/* ----------------------------------------------------------------- pieces */

/**
 * A picture analogy: `a` goes with `b`, so `c` goes with what?
 *
 * Two rows inside one frame, the way CogAT prints it -- the worked pair above,
 * the pair to finish below -- rather than all four boxes strung across a
 * single line. Stacked, the two pairs sit one under the other and the rule
 * being carried down is something a child can see; strung out, the four boxes
 * read as one sequence and the pairing has to be worked out before the item
 * can even be started. It is also the layout `countAnalogySvg` already uses
 * for number analogies, so the two batteries ask their question the same way.
 */
export function pictureAnalogySvg(a: string, b: string, c: string): string {
  const pad = 9;
  const span = 20;
  const rowGap = 10;
  const W = pad * 2 + CELL_W * 2 + span;
  const H = pad * 2 + CELL_H * 2 + rowGap;
  const right = pad + CELL_W + span;

  const row = (y: number, left: string, filled?: string) =>
    `${box(pad, y)}${cell(left, pad, y)}
     ${arrow(pad + CELL_W, y + CELL_H / 2, span)}
     ${box(right, y)}${filled ? cell(filled, right, y) : question(right, y)}`;

  return `<svg viewBox="0 0 ${W} ${H}" role="img" class="kx-fig-block"
    aria-label="${words(a)} goes with ${words(b)}. What goes with ${words(c)} the same way?">
    <rect x="0.75" y="0.75" width="${W - 1.5}" height="${H - 1.5}" rx="8"
      fill="none" stroke="var(--kx-fig-stroke)" stroke-width="1.5" opacity="0.45"/>
    ${row(pad, a, b)}
    ${row(pad + CELL_H + rowGap, c)}
  </svg>`;
}

/** Three pictures that belong together. */
export function pictureRowSvg(pictures: string[]): string {
  const gap = 10;
  const pad = 12;
  const W = pictures.length * CELL_W + (pictures.length - 1) * gap + pad * 2;
  const cells = pictures
    .map((p, i) => {
      const x = pad + i * (CELL_W + gap);
      return box(x, 0) + cell(p, x, 0);
    })
    .join("");
  return `<svg viewBox="0 0 ${W} ${CELL_H}" role="img"
    aria-label="Three pictures: ${pictures.map(words).join(", ")}.">${cells}</svg>`;
}

/**
 * One picture as an answer option, boxed like the cells in the question.
 *
 * Padded wider than the cell: an option is scaled to the width of its button,
 * and drawn tight it would tower over the pictures in the question it answers.
 */
export function pictureCardSvg(picture: string): string {
  const pad = 8;
  const W = CELL_W + pad * 2;
  return `<svg viewBox="0 0 ${W} ${CELL_H}" role="img" aria-label="${words(picture)}">
    ${box(pad, 0)}${cell(picture, pad, 0)}
  </svg>`;
}

/* ------------------------------------------------------- sets of objects */

/**
 * Number analogies, drawn the way Level 7 asks them: three pens become five
 * pens, so two basketballs become how many?
 *
 * The rule is about *how many*, so the objects carry no meaning and the
 * numerals never appear. Writing the same item as "3 → 5, 2 → ?" would be a
 * reading-and-symbols task for a child who has only just met either.
 */
const SET_W = 82;
const SET_H = 64;

/**
 * `count` copies of one object, packed to stay countable inside the box.
 *
 * Up to nine, because the NGAT's fourth-grade form multiplies where CogAT's
 * first-grade one adds -- three becoming six needs a box that can hold six.
 * Past nine the objects are too small to name, and counting them stops being
 * incidental to the question.
 */
function objectSet(picture: string, count: number, x: number, y: number): string {
  const { emoji } = parsePicture(picture);
  const art = ICONS[emoji];
  // Four reads as a square, not as a row of three with one stranded below.
  const perRow = count <= 3 ? count : count === 4 ? 2 : 3;
  const rows = Math.ceil(count / perRow);
  const size = rows === 1 ? (count <= 2 ? 27 : 23) : rows === 2 ? (count <= 4 ? 24 : 21) : 18;
  const stepX = size + 2;
  const stepY = size + 1;

  const drawn: string[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, count - row * perRow);
    const col = i % perRow;
    const cx = x + SET_W / 2 + (col - (inRow - 1) / 2) * stepX;
    const cy = y + SET_H / 2 + (row - (rows - 1) / 2) * stepY;
    drawn.push(
      art
        ? `<svg x="${(cx - size / 2).toFixed(1)}" y="${(cy - size / 2).toFixed(1)}"
            width="${size}" height="${size}" viewBox="0 0 ${ART} ${ART}">${art}</svg>`
        : `<text x="${cx.toFixed(1)}" y="${(cy + size / 3).toFixed(1)}" text-anchor="middle"
            font-size="${size}">${emoji}</text>`,
    );
  }
  return drawn.join("");
}

const setBox = (x: number, y: number) =>
  `<rect x="${x}" y="${y}" width="${SET_W}" height="${SET_H}" rx="6"
    fill="none" stroke="var(--kx-fig-stroke)" stroke-width="1.5" opacity="0.45"/>`;

/**
 * "3 kites", "5 butterflies", "2 fish".
 *
 * This reaches the printed answer key, not just the accessibility label, so
 * "butterflys" is a mistake a parent reads while marking a sheet.
 */
const INVARIANT_PLURALS = new Set(["fish", "sheep", "deer"]);

function plural(picture: string, n: number): string {
  const word = words(picture);
  if (n === 1 || INVARIANT_PLURALS.has(word)) return `${n} ${word}`;
  if (/[^aeiou]y$/.test(word)) return `${n} ${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(word)) return `${n} ${word}es`;
  return `${n} ${word}s`;
}

/** One of something becomes; several of them become. */
const verb = (n: number) => (n === 1 ? "becomes" : "become");

export interface ObjectSet {
  picture: string;
  from: number;
  to?: number;
}

/**
 * Two rows: a worked pair above, the pair to finish below. The layout matches
 * the picture and figure analogies -- box, arrow, box -- so a child meets one
 * shape of question across the whole test rather than three.
 */
export function countAnalogySvg(top: Required<ObjectSet>, bottom: ObjectSet): string {
  const span = 24;
  const rowGap = 10;
  const W = SET_W * 2 + span;
  const H = SET_H * 2 + rowGap;
  const right = SET_W + span;

  const row = (y: number, set: ObjectSet, filled: boolean) =>
    `${setBox(0, y)}${objectSet(set.picture, set.from, 0, y)}
     ${arrow(SET_W, y + SET_H / 2, span)}
     ${setBox(right, y)}${
       filled && set.to !== undefined
         ? objectSet(set.picture, set.to, right, y)
         : `<text x="${right + SET_W / 2}" y="${y + SET_H / 2 + 10}" text-anchor="middle"
             font-size="28" font-weight="700" fill="var(--kx-fig-stroke)">?</text>`
     }`;

  return `<svg viewBox="0 0 ${W} ${H}" role="img"
    aria-label="${plural(top.picture, top.from)} ${verb(top.from)} ${plural(top.picture, top.to)}. ${plural(bottom.picture, bottom.from)} ${verb(bottom.from)} how many?">
    ${row(0, top, true)}
    ${row(SET_H + rowGap, bottom, false)}
  </svg>`;
}

/** One answer option: a box holding some number of the same object. */
export function countCardSvg(picture: string, count: number): string {
  // Barely padded: an option is scaled to its button, and the wide box this
  // started with drew objects half the size of the ones in the question.
  const pad = 5;
  const W = SET_W + pad * 2;
  return `<svg viewBox="0 0 ${W} ${SET_H}" role="img" aria-label="${plural(picture, count)}">
    ${setBox(pad, 0)}${objectSet(picture, count, pad, 0)}
  </svg>`;
}
