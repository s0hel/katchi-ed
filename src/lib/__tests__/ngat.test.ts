import { describe, expect, it } from "vitest";
import { skillsFor } from "../curriculum";
import { generateQuestion } from "../generators";
import { NGAT_BANKS } from "../generators/exam-banks";
import { hasIcon } from "../generators/pictures";
import { figLook, type Fig } from "../generators/shapes";
import { turnBy } from "../generators/figure-rules";

/**
 * The NGAT's own properties, which no generic content test can see.
 *
 * Two of them decide the whole subject. The page carries no text but numerals,
 * which is the point of the format and the one thing a rewrite could quietly
 * lose. And the option count is the test's, not ours: five for the nonverbal
 * and quantitative items, six for the verbal one, where the pictures *are* the
 * options. `figureChoice` hands back however many distinct options it was
 * given, so a generator whose distractors collapse serves fewer without
 * saying so -- and that takes a lot of seeds to catch.
 */
const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7919 + 13);
const FEW = [1, 7, 42, 1234, 99999, 2 ** 30];

const NGAT = skillsFor("ngat", 4);
const find = (generator: string) => NGAT.find((s) => s.generator === generator)!;

/** An option's drawing, with the words stripped off. */
const drawing = (svg: string) => svg.replace(/aria-label="[^"]*"/, "").replace(/\s+/g, " ");

describe("NGAT catalog", () => {
  it("covers all three tests", () => {
    expect(new Set(NGAT.map((s) => s.strand))).toEqual(
      new Set(["Verbal Test", "Nonverbal Test", "Quantitative Test"]),
    );
  });

  it("asks the four nonverbal item types a Naglieri matrix test is built from", () => {
    const nonverbal = NGAT.filter((s) => s.strand === "Nonverbal Test").map((s) => s.generator);
    expect(new Set(nonverbal)).toEqual(
      new Set([
        "ngat-figure-matrices",
        "ngat-serial-reasoning",
        "ngat-pattern-completion",
        "ngat-spatial-visualization",
      ]),
    );
  });
});

describe("NGAT answer options", () => {
  for (const skill of NGAT) {
    const want = skill.generator === "ngat-odd-one-out" ? 6 : 5;
    it(`offers ${want} choices at every level: ${skill.id}`, () => {
      const short: string[] = [];
      for (let level = 1; level <= (skill.levels ?? 4); level++) {
        for (const seed of SEEDS) {
          const q = generateQuestion(skill, level, seed);
          if (q.format.kind !== "choice") throw new Error(`${skill.id}: not multiple choice`);
          if (q.format.choices.length !== want) {
            short.push(`level ${level}, seed ${seed}: ${q.format.choices.length} choices`);
          }
        }
      }
      expect(short.slice(0, 5)).toEqual([]);
    });
  }

  it("never draws two options the same", () => {
    const clashes: string[] = [];
    for (const skill of NGAT) {
      for (let level = 1; level <= 4; level++) {
        for (const seed of SEEDS) {
          const q = generateQuestion(skill, level, seed);
          if (q.format.kind !== "choice") continue;
          const drawn = (q.format.figures ?? []).map(drawing);
          if (drawn.length && new Set(drawn).size !== drawn.length) {
            clashes.push(`${skill.id} L${level} seed ${seed}`);
          }
        }
      }
    }
    expect(clashes.slice(0, 5)).toEqual([]);
  });
});

describe("nothing on the page but numerals", () => {
  /**
   * The Naglieri tests carry no words at all: the instructions are animated
   * and the items are pictures, shapes and numbers, so that a child is never
   * measured on what they can read. Our questions need a sentence of their own
   * -- there is no animation to play -- but nothing inside a *figure* may be
   * text, and nothing the learner picks between may be a word.
   */
  it("puts no words inside a figure", () => {
    const words: string[] = [];
    for (const skill of NGAT) {
      for (let level = 1; level <= 4; level++) {
        for (const seed of FEW) {
          const q = generateQuestion(skill, level, seed);
          const figures = [q.figure ?? "", ...(q.format.kind === "choice" ? (q.format.figures ?? []) : [])];
          for (const svg of figures) {
            for (const [, text] of svg.replace(/aria-label="[^"]*"/g, "").matchAll(/>([^<>]+)<\/text>/g)) {
              // A numeral is the one thing the test lets a reader read, and
              // "?" is the empty box rather than something to be read.
              if (!/^[\d?]+$/.test(text.trim())) words.push(`${skill.id}: "${text}"`);
            }
          }
        }
      }
    }
    expect(words.slice(0, 5)).toEqual([]);
  });

  it("answers every verbal item with a picture", () => {
    const verbal = NGAT.filter((s) => s.strand === "Verbal Test");
    expect(verbal.length).toBe(2);
    for (const skill of verbal) {
      for (let level = 1; level <= 4; level++) {
        for (const seed of FEW) {
          const q = generateQuestion(skill, level, seed);
          const where = `${skill.id} L${level} seed ${seed}`;
          if (q.format.kind !== "choice") throw new Error(`${where}: not multiple choice`);
          // The six pictures are the question, so there is no prompt figure to
          // show above them -- and every option has to be artwork, not a glyph
          // standing in for it.
          expect(q.figure, where).toBeUndefined();
          expect(q.format.figures?.length, where).toBe(6);
          for (const figure of q.format.figures!) expect(figure, where).toContain("<path");
        }
      }
    }
  });

  it("never offers a fourth grader a negative number", () => {
    for (const skill of NGAT.filter((s) => s.strand === "Quantitative Test")) {
      for (let level = 1; level <= 4; level++) {
        for (const seed of SEEDS.slice(0, 60)) {
          const q = generateQuestion(skill, level, seed);
          // What the item says, not how it is drawn: an SVG is full of
          // negative coordinates and none of them reach the learner.
          const labels = [q.figure ?? "", ...(q.format.kind === "choice" ? (q.format.figures ?? []) : [])]
            .flatMap((svg) => [...svg.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]));
          const shown = [
            q.stem,
            q.answer,
            ...labels,
            ...(q.format.kind === "choice" ? q.format.choices : []),
          ].join(" ");
          // A sign sits against its number; a subtraction operator is spaced.
          expect(/[−-]\d/.test(shown), `${skill.id} L${level} seed ${seed}`).toBe(false);
        }
      }
    }
  });
});

describe("the verbal bank", () => {
  it("splits into two skills that both have enough to draw on", () => {
    for (const kind of ["category", "property"]) {
      const items = NGAT_BANKS.oddOneOut.filter((i) => i.kind === kind);
      // The bottom tier sees the front 45% of a bank; below about ten items
      // that slice is the same handful of questions every time.
      expect(items.length, kind).toBeGreaterThanOrEqual(12);
    }
  });

  it("has drawable artwork for every picture", () => {
    // Run: npx vite-node scripts/build-icons.ts
    const pictures = NGAT_BANKS.oddOneOut.flatMap((i) => [...i.group, i.odd]);
    expect(pictures.filter((p) => !hasIcon(p))).toEqual([]);
  });

  it("reaches the whole bank as the levels climb", () => {
    for (const skill of NGAT.filter((s) => s.generator === "ngat-odd-one-out")) {
      const kind = skill.params?.kind;
      const items = NGAT_BANKS.oddOneOut.filter((i) => i.kind === kind);
      const asked = new Set(
        SEEDS.map((seed) => generateQuestion(skill, 4, seed).explanation),
      );
      expect(asked.size, skill.id).toBe(items.length);
    }
  });
});

describe("the nonverbal items", () => {
  it("gives every nonverbal option a picture", () => {
    for (const skill of NGAT.filter((s) => s.strand === "Nonverbal Test")) {
      for (let level = 1; level <= 4; level++) {
        for (const seed of FEW) {
          const q = generateQuestion(skill, level, seed);
          const where = `${skill.id} L${level} seed ${seed}`;
          expect(q.figure, `${where}: no prompt figure`).toBeTruthy();
          if (q.format.kind !== "choice") throw new Error(`${where}: not multiple choice`);
          expect(q.format.figures?.length, where).toBe(q.format.choices.length);
        }
      }
    }
  });

  /**
   * The invariant the whole figure kit exists to keep: a question and the
   * options answering it are measured in the same cell, so "the shape gets
   * bigger" can be read across the two panels. It is also a width budget --
   * the prompt panel stops at three cells -- and a matrix is the first figure
   * here wide enough to hit it.
   */
  it("measures a question and its options in the same cell, three cells at most", () => {
    const perCell = (svg: string) => {
      const box = Number(/viewBox="[\d.\s]*?([\d.]+) [\d.]+"/.exec(svg)![1]);
      const [, wide, cell] = /--kx-fig-cell, 8rem\) \* ([\d.]+) \/ ([\d.]+)\)/.exec(svg)!;
      return { unit: (box * Number(cell)) / Number(wide), cells: Number(wide) / Number(cell) };
    };
    for (const skill of NGAT.filter((s) => s.strand === "Nonverbal Test")) {
      for (let level = 1; level <= 4; level++) {
        for (const seed of FEW) {
          const q = generateQuestion(skill, level, seed);
          const where = `${skill.id} L${level} seed ${seed}`;
          const prompt = perCell(q.figure!);
          expect(prompt.cells, `${where}: prompt is ${prompt.cells} cells wide`).toBeLessThanOrEqual(3);
          if (q.format.kind !== "choice") continue;
          for (const option of q.format.figures ?? []) {
            expect(perCell(option).unit, where).toBe(prompt.unit);
          }
        }
      }
    }
  });

  /**
   * Spatial visualization is the one item whose wrong options are all built
   * the same way -- the figure's mirror image, at four angles. If any of them
   * were reachable by turning the figure instead, the item would have two
   * defensible answers and one of them would be marked wrong.
   */
  it("keeps every mirror image out of reach of a turn", () => {
    const skill = find("ngat-spatial-visualization");
    /** What a figure draws, with the frame it was drawn in stripped off. */
    const drawn = (svg: string) => svg.replace(/^[\s\S]*?<\/rect>|^[\s\S]*?>/, "").replace(/<\/svg>\s*$/, "").replace(/\s+/g, " ").trim();
    const labelsOf = (svg: string) => /aria-label="([^"]*)"/.exec(svg)![1];

    for (let level = 1; level <= 4; level++) {
      for (const seed of SEEDS.slice(0, 120)) {
        const q = generateQuestion(skill, level, seed);
        const where = `${skill.id} L${level} seed ${seed}`;
        if (q.format.kind !== "choice") throw new Error(where);
        const figures = q.format.figures!;
        const keyed = figures[q.format.choices.indexOf(q.answer)];

        // The keyed option is the figure turned, so it is never the figure
        // standing still -- an item answerable without turning anything.
        expect(drawn(q.figure!), `${where}: the answer is the question`).not.toContain(drawn(keyed));
        // ...and it is the only option that is not a mirror image. This is the
        // whole item: four of the five cannot be reached by turning, and if
        // one of them could, it would be a second right answer marked wrong.
        expect(labelsOf(keyed), `${where}: the answer is mirrored`).not.toContain("mirrored");
        figures.forEach((svg, i) => {
          if (q.format.kind === "choice" && q.format.choices[i] === q.answer) return;
          expect(labelsOf(svg), `${where}: option ${i} is not a mirror image`).toContain("mirrored");
        });
      }
    }
  });

  it("sees a mirror that a turn cannot undo", () => {
    // The check `chiralFig` makes, stated on its own: a shape with an axis of
    // symmetry is its own mirror image and cannot carry this item at all.
    const fig = (over: Partial<Fig>): Fig => ({ shape: "star", shading: "open", size: 2, count: 1, ...over });
    const reachable = (f: Fig) => new Set([0, 1, 2, 3].map((q) => figLook(turnBy(f, q))));
    const star = fig({});
    expect([...reachable({ ...star, flip: true })].some((k) => reachable(star).has(k))).toBe(true);
    const ell = fig({ shape: "ell" });
    expect([...reachable({ ...ell, flip: true })].some((k) => reachable(ell).has(k))).toBe(false);
  });
});

describe("the quantitative items", () => {
  it("keys a number series against the run it printed", () => {
    const skill = find("ngat-number-series");
    for (let level = 1; level <= 4; level++) {
      for (const seed of SEEDS.slice(0, 120)) {
        const q = generateQuestion(skill, level, seed);
        const where = `${skill.id} L${level} seed ${seed}`;
        // The run is read back out of the explanation, and the blank out of
        // the figure, so the keyed answer is checked against what was drawn.
        const terms = /: ([\d, ]+)\. So/.exec(q.explanation)![1].split(", ").map(Number);
        const shown = /aria-label="([^"]*)"/.exec(q.figure!)![1];
        const printed = shown.replace(/\.$/, "").split(", ");
        expect(printed.length, where).toBe(terms.length);
        const blank = printed.indexOf("a missing number");
        expect(blank, `${where}: no blank in ${shown}`).toBeGreaterThanOrEqual(0);
        expect(Number(q.answer), where).toBe(terms[blank]);
        // Everything else on the page is the run, in order.
        printed.forEach((cell, i) => {
          if (i !== blank) expect(Number(cell), where).toBe(terms[i]);
        });
      }
    }
  });

  it("applies one rule to both rows of a number analogy", () => {
    const skill = find("ngat-number-analogies");
    for (let level = 1; level <= 4; level++) {
      for (const seed of SEEDS.slice(0, 120)) {
        const q = generateQuestion(skill, level, seed);
        const where = `${skill.id} L${level} seed ${seed}`;
        const label = /aria-label="([^"]*)"/.exec(q.figure ?? "")?.[1] ?? "";
        // Objects can be two words ("ice cream"), so the counts are read by
        // position around the verb rather than by counting words.
        const [, from, to, bottomFrom] = /^(\d+) [^.]*?becomes? (\d+) [^.]*\. (\d+) /.exec(label)!;
        if (q.format.kind !== "choice") throw new Error(where);
        const keyed = q.format.figures![q.format.choices.indexOf(q.answer)];
        const answer = Number(/aria-label="(\d+) /.exec(keyed)![1]);
        // Whatever the rule was, it has to take the top row where it went and
        // the bottom row to the keyed option.
        const scale = Number(to) / Number(from);
        const step = Number(to) - Number(from);
        expect(
          answer === Number(bottomFrom) + step || answer === Number(bottomFrom) * scale,
          `${where}: ${label} -> ${answer}`,
        ).toBe(true);
        // Nothing on the page counts past what stays countable in a box.
        for (const n of [from, to, bottomFrom, `${answer}`]) {
          expect(Number(n), where).toBeGreaterThanOrEqual(1);
          expect(Number(n), where).toBeLessThanOrEqual(9);
        }
      }
    }
  });

  it("gives a number matrix rows and columns that both hold", () => {
    const skill = find("ngat-number-matrices");
    for (let level = 1; level <= 4; level++) {
      for (const seed of SEEDS.slice(0, 120)) {
        const q = generateQuestion(skill, level, seed);
        const where = `${skill.id} L${level} seed ${seed}`;
        const label = /aria-label="([^"]*)"/.exec(q.figure!)![1];
        const rows = label
          .replace(/\.$/, "")
          .split(". ")
          .map((row) => row.replace(/^Row \d+: /, "").split(", "));
        const grid = rows.map((row) =>
          row.map((cell) => (cell === "a missing number" ? Number(q.answer) : Number(cell))),
        );
        // Filled in with the keyed answer, every row steps the same way and so
        // does every column -- which is the only thing that makes it a matrix.
        for (const row of grid) {
          const steps = row.slice(1).map((n, i) => n - row[i]);
          const ratios = row.slice(1).map((n, i) => n / row[i]);
          expect(
            new Set(steps).size === 1 || new Set(ratios).size === 1,
            `${where}: row ${row.join(", ")}`,
          ).toBe(true);
        }
        for (let c = 0; c < grid[0].length; c++) {
          const col = grid.map((row) => row[c]);
          const steps = col.slice(1).map((n, i) => n - col[i]);
          expect(new Set(steps).size, `${where}: column ${col.join(", ")}`).toBe(1);
        }
      }
    }
  });

  it("keys equal amounts on the count and nothing else", () => {
    const skill = find("ngat-equal-amounts");
    for (let level = 1; level <= 4; level++) {
      for (const seed of SEEDS.slice(0, 120)) {
        const q = generateQuestion(skill, level, seed);
        const where = `${skill.id} L${level} seed ${seed}`;
        if (q.format.kind !== "choice") throw new Error(where);
        const dots = (svg: string) => Number(/aria-label="(\d+) dot/.exec(svg)![1]);
        const shown = dots(q.figure!);
        const rows = (svg: string) => /aria-label="[^"]*, in ([^."]*)/.exec(svg)![1];
        q.format.figures!.forEach((svg, i) => {
          const right = q.format.kind === "choice" && q.format.choices[i] === q.answer;
          // Exactly one option holds the same number, and it is laid out
          // differently -- otherwise the picture could simply be matched.
          expect(dots(svg) === shown, `${where}: option ${i} has ${dots(svg)} of ${shown}`).toBe(right);
          if (right) expect(rows(svg), where).not.toBe(rows(q.figure!));
        });
      }
    }
  });
});
