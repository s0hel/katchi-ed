import iconData from "../../data/picture-icons.json";

/**
 * Picture items, drawn rather than typed.
 *
 * The banks write a picture as an emoji and its word ("🧦 sock") because that
 * is what a reviewer can read in a diff. What a six-year-old sees is this:
 * real artwork at the size of the question, with the word beneath it in small
 * type for whoever is reading the item aloud.
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
]);

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

const CELL_W = 52;
const CELL_H = 56;
const ICON = 32;

/**
 * The word under a picture, wrapped to two lines and shrunk for long words so
 * "sunglasses" and "cold weather" stay inside their cell.
 */
function caption(word: string, cx: number, top: number): string {
  const words = word.split(" ");
  const lines = words.length > 1 && word.length > 9 ? [words[0], words.slice(1).join(" ")] : [word];
  const longest = Math.max(...lines.map((l) => l.length));
  const size = Math.min(8.5, (CELL_W - 4) / (longest * 0.56));
  return lines
    .map(
      (line, i) =>
        `<text x="${cx}" y="${(top + size + i * (size + 1.5)).toFixed(1)}" text-anchor="middle"
          font-size="${size.toFixed(1)}" font-weight="600" fill="var(--kx-text)">${escapeText(line)}</text>`,
    )
    .join("");
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** One picture: artwork above, word below. Missing artwork falls back to the glyph. */
function cell(picture: string, x: number, y: number): string {
  const { emoji, word } = parsePicture(picture);
  const art = ICONS[emoji];
  const ix = x + (CELL_W - ICON) / 2;
  const drawn = art
    ? `<svg x="${ix}" y="${y + 3}" width="${ICON}" height="${ICON}" viewBox="0 0 ${ART} ${ART}">${art}</svg>`
    : `<text x="${x + CELL_W / 2}" y="${y + ICON}" text-anchor="middle" font-size="${ICON * 0.8}">${emoji}</text>`;
  return drawn + caption(word, x + CELL_W / 2, y + ICON + 7);
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
 * Laid out exactly like the nonverbal figure analogy, arrows and all. The two
 * batteries ask the same question of different material, and a child who has
 * learned to read one layout should not have to learn a second.
 */
export function pictureAnalogySvg(a: string, b: string, c: string): string {
  const gap = 14;
  const span = 16;
  const xa = 0;
  const xb = CELL_W + span;
  const xc = xb + CELL_W + gap;
  const xq = xc + CELL_W + span;
  const W = xq + CELL_W;
  const mid = CELL_H / 2;

  return `<svg viewBox="0 0 ${W} ${CELL_H}" role="img"
    aria-label="${words(a)} goes with ${words(b)}. What goes with ${words(c)} the same way?">
    ${box(xa, 0)}${cell(a, xa, 0)}
    ${arrow(CELL_W, mid, span)}
    ${box(xb, 0)}${cell(b, xb, 0)}
    ${box(xc, 0)}${cell(c, xc, 0)}
    ${arrow(xc + CELL_W, mid, span)}
    ${box(xq, 0)}${question(xq, 0)}
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
 * One picture as an answer option. Padded well wider than the cell: an option
 * is scaled to the width of its button, and drawn tight it would tower over
 * the pictures in the question it answers.
 */
export function pictureCardSvg(picture: string): string {
  const W = 82;
  const x = (W - CELL_W) / 2;
  return `<svg viewBox="0 0 ${W} ${CELL_H}" role="img" aria-label="${words(picture)}">
    ${cell(picture, x, 0)}
  </svg>`;
}
