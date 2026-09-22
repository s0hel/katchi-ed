/**
 * Vendors the picture icons the CogAT and NGAT banks need (run by a maintainer,
 * not at runtime).
 *
 *   npx vite-node scripts/build-icons.ts
 *   npx vite-node scripts/build-icons.ts -- --check   # CI: fail, do not write
 *
 * Both tests answer their verbal items with pictures, and a picture has to be
 * big and clear enough to name at a glance. An emoji set in running text
 * is neither: it renders at the font size, and it renders as whatever glyph
 * the reader's device happens to ship. So the banks keep writing pictures as
 * emoji -- which is what makes them reviewable in a diff -- and this script
 * turns each one into real SVG artwork the app draws itself, at whatever size
 * the question needs.
 *
 * Only the icons actually used are vendored, so the repo carries a hundred or
 * so files' worth of paths rather than all 3,700.
 *
 * Artwork: Twemoji (https://github.com/jdecked/twemoji), licensed CC BY 4.0.
 * Delivered through the MIT-licensed @twemoji/svg package. The licence needs
 * attribution wherever the icons appear, which src/components/picture-credit
 * and the README provide.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { COGAT_BANKS, NGAT_BANKS } from "../src/lib/generators/exam-banks";
import { COUNTABLE_OBJECTS } from "../src/lib/generators/pictures";

const OUT = "src/data/picture-icons.json";
const SRC = "node_modules/@twemoji/svg";

/**
 * Twemoji's own filename rule: codepoints in lowercase hex joined by "-",
 * with the variation selector U+FE0F dropped unless the sequence is joined by
 * a zero-width joiner. "1️⃣" is 31-20e3, "👩‍🏫" is 1f469-200d-1f3eb.
 */
function codePoint(emoji: string): string {
  const zwj = "‍";
  const normalized = emoji.includes(zwj) ? emoji : emoji.replace(/️/g, "");
  return [...normalized].map((c) => c.codePointAt(0)!.toString(16)).join("-");
}

/** The emoji half of a picture field ("🧦 sock" -> "🧦"). */
function emojiOf(picture: string): string {
  return picture.split(" ")[0];
}

function usedEmoji(): string[] {
  const pictures: string[] = [];
  for (const item of COGAT_BANKS.pictureAnalogies) {
    pictures.push(item.a, item.b, item.c, item.answer, ...item.wrong);
  }
  for (const item of COGAT_BANKS.pictureGroups) {
    pictures.push(...item.group, item.answer, ...item.wrong);
  }
  for (const item of COGAT_BANKS.sentenceCompletion) {
    pictures.push(item.answer, ...item.wrong);
  }
  for (const item of NGAT_BANKS.oddOneOut) {
    pictures.push(...item.group, item.odd);
  }
  // Not from a bank: number analogies count these, and an object with no
  // artwork would be drawn as a text glyph six times over.
  pictures.push(...COUNTABLE_OBJECTS);
  return [...new Set(pictures.map(emojiOf))].sort();
}

/** The artwork itself, with Twemoji's outer <svg> wrapper removed. */
function artwork(emoji: string): string {
  const file = `${SRC}/${codePoint(emoji)}.svg`;
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    throw new Error(`no Twemoji artwork for ${emoji} (looked for ${file})`);
  }
  const viewBox = /viewBox="([^"]+)"/.exec(raw)?.[1];
  if (viewBox !== "0 0 36 36") {
    throw new Error(`${emoji} has an unexpected viewBox "${viewBox}"; the renderer assumes 0 0 36 36`);
  }
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").trim();
  if (!inner) throw new Error(`${emoji} produced empty artwork`);
  return inner;
}

function main() {
  const check = process.argv.includes("--check");
  const icons: Record<string, string> = {};
  const missing: string[] = [];

  for (const emoji of usedEmoji()) {
    try {
      icons[emoji] = artwork(emoji);
    } catch (err) {
      missing.push((err as Error).message);
    }
  }

  for (const m of missing) console.log(`  ERR  ${m}`);
  if (missing.length) {
    console.log(`\n${missing.length} picture(s) cannot be drawn. Fix the bank item or pick another emoji.`);
    process.exit(1);
  }

  const json = JSON.stringify(icons, null, 2) + "\n";
  const current = (() => {
    try {
      return readFileSync(OUT, "utf8");
    } catch {
      return "";
    }
  })();

  if (check) {
    if (json !== current) {
      console.log(`${OUT} is out of date -- run: npx vite-node scripts/build-icons.ts`);
      process.exit(1);
    }
    console.log(`${OUT} is up to date (${Object.keys(icons).length} icons)`);
    return;
  }

  writeFileSync(OUT, json);
  const kb = Math.round(json.length / 102.4) / 10;
  console.log(`wrote ${OUT}: ${Object.keys(icons).length} icons, ${kb} kB`);
}

main();
