import { describe, expect, it } from "vitest";
import { skillsFor } from "../curriculum";
import { generateQuestion } from "../generators";
import { NGAT_BANKS } from "../generators/exam-banks";
import { hasIcon } from "../generators/pictures";
import { fits } from "../generators/ngat";

/**
 * The NGAT's own properties, which no generic content test can see.
 *
 * Three of them decide the subject. The page carries no text but numerals,
 * which is the point of the format and the one thing a rewrite could quietly
 * lose. The option count is the test's, not ours: five everywhere except the
 * verbal odd one out, where the six pictures *are* the options. And the twelve
 * skills are the twelve item types the published walkthrough demonstrates --
 * asserted here because an earlier version of this file was perfectly happy
 * with ten, two of which we had invented.
 */
const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7919 + 13);
const FEW = [1, 7, 42, 1234, 99999, 2 ** 30];

const GRADES = [1, 4] as const;
const NGAT = GRADES.flatMap((g) => skillsFor("ngat", g));
const find = (generator: string, grade = 4) =>
  skillsFor("ngat", grade).find((s) => s.generator === generator)!;

/** An option's drawing, with the words stripped off. */
const drawing = (svg: string) => svg.replace(/aria-label="[^"]*"/, "").replace(/\s+/g, " ");
const labelOf = (svg: string) => /aria-label="([^"]*)"/.exec(svg)?.[1] ?? "";

/** The items that show the six pictures and ask which is not like the rest. */
const ODD_ONE_OUT = ["ngat-odd-one-out", "ngat-figure-odd-one-out"];

describe("NGAT catalog", () => {
  it("asks the item types the test's own walkthrough demonstrates", () => {
    const byStrand = (strand: string) =>
      new Set(skillsFor("ngat", 4).filter((s) => s.strand === strand).map((s) => s.generator));

    // Three verbal, and this is the one worth spelling out: the verbal test is
    // not one item type asked over and over. It is six pictures with an odd one
    // out, a picture analogy, and a pair to find across two rows.
    expect(byStrand("Verbal Test")).toEqual(
      new Set(["ngat-odd-one-out", "ngat-picture-analogies", "ngat-picture-pairs"]),
    );
    expect(byStrand("Nonverbal Test")).toEqual(
      new Set([
        "ngat-figure-matrices",
        "ngat-serial-reasoning",
        "ngat-figure-odd-one-out",
        "ngat-pattern-completion",
        "ngat-spatial-visualization",
      ]),
    );
    expect(byStrand("Quantitative Test")).toEqual(
      new Set([
        "ngat-number-series",
        "ngat-number-analogies",
        "ngat-number-matrices",
        "ngat-balance",
      ]),
    );
  });

  it("asks both grades the same twelve questions", () => {
    // One instrument read at two ages. If a form ever drops a question rather
    // than asking an easier version of it, that is a decision worth making on
    // purpose rather than one that fell out of a ramp.
    const generators = (grade: number) => skillsFor("ngat", grade).map((s) => s.generator);
    expect(generators(1)).toEqual(generators(4));
    expect(generators(1)).toHaveLength(12);
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
    // Twelve skills at two grades, four levels, three hundred seeds: the sweep
    // is the point of the test, and it costs more than the default allows.
  }, 30_000);
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
    expect(verbal.length).toBe(GRADES.length * 3);
    for (const skill of verbal) {
      for (let level = 1; level <= 4; level++) {
        for (const seed of FEW) {
          const q = generateQuestion(skill, level, seed);
          const where = `${skill.id} L${level} seed ${seed}`;
          if (q.format.kind !== "choice") throw new Error(`${where}: not multiple choice`);
          // The odd one out has no prompt above its options, because the six
          // pictures it offers *are* the question. The other two show a row or
          // a pair to reason from. Either way every option is real artwork,
          // which is checked by the absence of the text fallback rather than
          // the presence of a <path>: a picture can be drawn entirely out of
          // circles, as Twemoji's full moon is.
          if (skill.generator === "ngat-odd-one-out") expect(q.figure, where).toBeUndefined();
          else expect(q.figure, where).toContain("<svg");
          expect(q.format.figures?.length, where).toBe(q.format.choices.length);
          for (const figure of q.format.figures!) {
            expect(figure.replace(/aria-label="[^"]*"/, ""), where).not.toContain("<text");
          }
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
            .map(labelOf);
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

describe("the verbal banks", () => {
  const BANKS = ["oddOneOut", "pictureAnalogies", "pairs"] as const;

  it("fills every form of every item type", () => {
    for (const bank of BANKS) {
      for (const band of ["K-2", "3-6"]) {
        const items = NGAT_BANKS[bank].filter((i) => i.band === band);
        // The bottom tier sees the front 45% of a bank; below about ten items
        // that slice is the same handful of questions every time. Six pools,
        // because a grade draws from three of them and never sees the rest.
        expect(items.length, `${bank} ${band}`).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it("has drawable artwork for every picture", () => {
    // Run: npx vite-node scripts/build-icons.ts
    const pictures = [
      ...NGAT_BANKS.oddOneOut.flatMap((i) => [...i.group, i.odd]),
      ...NGAT_BANKS.pictureAnalogies.flatMap((i) => [i.a, i.b, i.c, i.answer, ...i.wrong]),
      ...NGAT_BANKS.pairs.flatMap((i) => [...i.top, i.answer, ...i.wrong]),
    ];
    expect(pictures.filter((p) => !hasIcon(p))).toEqual([]);
  });

  it("reaches its own form's whole bank, and none of the other's", () => {
    for (const skill of NGAT.filter((s) => s.strand === "Verbal Test")) {
      const band = skill.grade <= 2 ? "K-2" : "3-6";
      const bank =
        skill.generator === "ngat-odd-one-out"
          ? NGAT_BANKS.oddOneOut.filter((i) => i.band === band).map((i) => `Five of them are alike: ${i.concept}. ${i.why}`)
          : (skill.generator === "ngat-picture-analogies" ? NGAT_BANKS.pictureAnalogies : NGAT_BANKS.pairs)
              .filter((i) => i.band === band)
              .map((i) => i.why);
      // Every item of its own form, and nothing else at all: a first grader
      // must never meet "each one is made of glass", and a fourth grader is
      // not practising on "they are all animals".
      const asked = new Set(SEEDS.map((seed) => generateQuestion(skill, 4, seed).explanation));
      expect(asked, skill.id).toEqual(new Set(bank));
    }
  });
});

describe("the nonverbal items", () => {
  const nonverbal = NGAT.filter((s) => s.strand === "Nonverbal Test");

  it("gives every nonverbal option a picture", () => {
    for (const skill of nonverbal) {
      for (let level = 1; level <= 4; level++) {
        for (const seed of FEW) {
          const q = generateQuestion(skill, level, seed);
          const where = `${skill.id} L${level} seed ${seed}`;
          // As in the verbal test, the odd one out shows nothing above its
          // options because the figures it offers are the question.
          if (!ODD_ONE_OUT.includes(skill.generator)) {
            expect(q.figure, `${where}: no prompt figure`).toBeTruthy();
          }
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
    for (const skill of nonverbal) {
      for (let level = 1; level <= 4; level++) {
        for (const seed of FEW) {
          const q = generateQuestion(skill, level, seed);
          const where = `${skill.id} L${level} seed ${seed}`;
          if (q.format.kind !== "choice") continue;
          const options = (q.format.figures ?? []).map(perCell);
          for (const option of options) {
            expect(option.cells, `${where}: an option is ${option.cells} cells wide`).toBe(1);
          }
          if (!q.figure) continue;
          const prompt = perCell(q.figure);
          expect(prompt.cells, `${where}: prompt is ${prompt.cells} cells wide`).toBeLessThanOrEqual(3);
          for (const option of options) expect(option.unit, where).toBe(prompt.unit);
        }
      }
    }
  });

  it("leaves exactly one figure out of the group", () => {
    const skill = find("ngat-figure-odd-one-out");
    for (let level = 1; level <= 4; level++) {
      for (const seed of SEEDS.slice(0, 120)) {
        const q = generateQuestion(skill, level, seed);
        const where = `${skill.id} L${level} seed ${seed}`;
        if (q.format.kind !== "choice") throw new Error(where);
        // The explanation names the group's rule and the one figure outside
        // it, and that figure has to be the keyed option rather than whichever
        // one the sentence happens to end on.
        const odd = /Only (.*) is not\.$/.exec(q.explanation)?.[1];
        expect(odd, `${where}: ${q.explanation}`).toBeTruthy();
        const keyed = q.format.figures![q.format.choices.indexOf(q.answer)];
        expect(labelOf(keyed), where).toBe(odd);
      }
    }
  });
});

describe("pieces that fit together", () => {
  /**
   * `fits` is what makes the spatial item honest: the keyed set of pieces is
   * right by construction, but a wrong set is only wrong if it genuinely
   * cannot be made to cover the shape -- and a child is free to turn a piece
   * round. These are the cases that would break it.
   */
  const at = (...pairs: [number, number][]) => pairs.map(([c, r]) => ({ c, r }));
  const square = at([0, 0], [1, 0], [0, 1], [1, 1]);
  const domino = at([0, 0], [1, 0]);
  const ell = at([0, 0], [1, 0], [0, 1]);

  it("covers a square with two dominoes", () => {
    expect(fits(square, [domino, domino])).toBe(true);
  });

  it("turns a piece round when it has to", () => {
    // Two upright dominoes also make the square, which they only do turned.
    expect(fits(square, [at([0, 0], [0, 1]), at([0, 0], [0, 1])])).toBe(true);
  });

  it("refuses a set that cannot cover it however it is turned", () => {
    // Four squares of shape, four squares of pieces, and no way to lay them.
    expect(fits(square, [ell, at([0, 0])])).toBe(true);
    expect(fits(at([0, 0], [1, 0], [2, 0], [3, 0]), [square])).toBe(false);
    expect(fits(square, [ell, ell])).toBe(false);
  });

  it("refuses a set with the wrong number of squares", () => {
    expect(fits(square, [domino])).toBe(false);
    expect(fits(square, [domino, domino, domino])).toBe(false);
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
        const printed = labelOf(q.figure!).replace(/\.$/, "").split(", ");
        expect(printed.length, where).toBe(terms.length);
        const blank = printed.indexOf("a missing number");
        expect(blank, `${where}: no blank in ${printed.join(", ")}`).toBeGreaterThanOrEqual(0);
        expect(Number(q.answer), where).toBe(terms[blank]);
        printed.forEach((cell, i) => {
          if (i !== blank) expect(Number(cell), where).toBe(terms[i]);
        });
      }
    }
  });

  it("applies one rule to every pair of a number analogy", () => {
    for (const grade of GRADES) {
      for (let level = 1; level <= 4; level++) {
        for (const seed of SEEDS.slice(0, 80)) {
          const q = generateQuestion(find("ngat-number-analogies", grade), level, seed);
          const where = `ngat-${grade} L${level} seed ${seed}`;
          const label = labelOf(q.figure!);
          if (level <= 2) {
            // Counted out in objects. Objects can be two words ("ice cream"),
            // so the counts are read by position around the verb.
            const [, from, to, bottomFrom] = /^(\d+) [^.]*?becomes? (\d+) [^.]*\. (\d+) /.exec(label)!;
            if (q.format.kind !== "choice") throw new Error(where);
            const keyed = q.format.figures![q.format.choices.indexOf(q.answer)];
            const answer = Number(/^(\d+) /.exec(labelOf(keyed))![1]);
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
          } else {
            // Written out. Every worked pair moves the same way, and so does
            // the pair holding the blank once the answer is in it.
            const rows = label
              .replace(/\.$/, "")
              .split(". ")
              .map((row) => row.replace(/^Row \d+: /, "").split(", "));
            const pairs = rows.map((row) =>
              row.map((n) => (n === "a missing number" ? Number(q.answer) : Number(n))),
            );
            const steps = new Set(pairs.map(([a, b]) => b - a));
            const ratios = new Set(pairs.map(([a, b]) => b / a));
            expect(steps.size === 1 || ratios.size === 1, `${where}: ${label}`).toBe(true);
          }
        }
      }
    }
  });

  it("gives a number matrix rows and columns that both hold", () => {
    for (const grade of GRADES) {
      for (let level = 1; level <= 4; level++) {
        for (const seed of SEEDS.slice(0, 80)) {
          const q = generateQuestion(find("ngat-number-matrices", grade), level, seed);
          const where = `ngat-${grade} L${level} seed ${seed}`;
          const rows = labelOf(q.figure!)
            .replace(/\.$/, "")
            .split(". ")
            .map((row) => row.replace(/^Row \d+: /, "").split(", "));
          const grid = rows.map((row) =>
            row.map((cell) => (cell === "a missing number" ? Number(q.answer) : Number(cell))),
          );
          // Filled in with the keyed answer, every row moves the same way as
          // every other row -- which is what makes it a matrix, whether that
          // way is one step, an alternating pair of them, or a multiplication.
          const across = grid.map((row) => row.slice(1).map((n, i) => n - row[i]).join("|"));
          const scaled = grid.map((row) => row.slice(1).map((n, i) => n / row[i]).join("|"));
          expect(
            new Set(across).size === 1 || new Set(scaled).size === 1,
            `${where}: rows ${grid.map((r) => r.join(" ")).join(" / ")}`,
          ).toBe(true);
          for (let c = 0; c < grid[0].length; c++) {
            const col = grid.map((row) => row[c]);
            const steps = col.slice(1).map((n, i) => n - col[i]);
            expect(new Set(steps).size, `${where}: column ${col.join(", ")}`).toBe(1);
          }
        }
      }
    }
  });

  it("balances the scales on weight and nothing else", () => {
    /** What a pan holds, counted off its description. */
    const holds = (text: string) => {
      const counts: Record<string, number> = {};
      for (const [, shape] of text.matchAll(/small solid ([\w-]+)/g)) {
        counts[shape] = (counts[shape] ?? 0) + 1;
      }
      return counts;
    };
    const weigh = (pan: Record<string, number>, rate: Record<string, number>) =>
      Object.entries(pan).reduce((n, [shape, count]) => n + count * (rate[shape] ?? 1), 0);
    const sameLoad = (a: Record<string, number>, b: Record<string, number>) => {
      const shapes = new Set([...Object.keys(a), ...Object.keys(b)]);
      return [...shapes].every((s) => (a[s] ?? 0) === (b[s] ?? 0));
    };

    for (const grade of GRADES) {
      for (let level = 1; level <= 4; level++) {
        for (const seed of SEEDS.slice(0, 80)) {
          const q = generateQuestion(find("ngat-balance", grade), level, seed);
          const where = `ngat-${grade} L${level} seed ${seed}`;
          if (q.format.kind !== "choice") throw new Error(where);
          const scales = labelOf(q.figure!).split(", and below it ");
          // With two balances the top one prices one shape in another, and
          // nothing below it can be answered without spending that price.
          const rate: Record<string, number> = {};
          if (scales.length === 2) {
            const [left, right] = scales[0].split(" against ").map(holds);
            const heavy = Object.keys(right)[0];
            rate[heavy] = Object.values(left).reduce((a, b) => a + b, 0);
          }
          const asked = holds(scales[scales.length - 1].split(" against ")[0]);
          const target = weigh(asked, rate);
          q.format.figures!.forEach((svg, i) => {
            const right = q.format.kind === "choice" && q.format.choices[i] === q.answer;
            const pan = holds(labelOf(svg));
            // With one balance nothing on the page says what any shape weighs,
            // so the only defensible answer is the same things rearranged.
            // With two, the top one prices them and the weights can be added.
            const balances = scales.length === 1 ? sameLoad(pan, asked) : weigh(pan, rate) === target;
            expect(balances, `${where}: option ${i} holds ${JSON.stringify(pan)}`).toBe(right);
          });
        }
      }
    }
  });
});

/**
 * The two forms, held apart.
 *
 * Everything above holds of both, which is the easy half: the same twelve
 * questions asked of a first grader and a fourth grader. The hard half is that
 * a form is not a difficulty dial -- it decides what gets asked at all -- and
 * nothing else in this file would notice if the first-grade form quietly
 * started printing nine-box grids or multiplying, because every one of those
 * items would still be well-formed and still have exactly one answer.
 */
describe("the two forms", () => {
  const boxes = (svg: string) => {
    const [, w, h] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)!.map(Number);
    return (w / 72) * (h / 72);
  };
  const grids = ["ngat-figure-matrices", "ngat-serial-reasoning"];
  const MULTIPLIES = /Double|[Mm]ultiply|times as many|half as many|halve it|a third as many|divide by/;

  /** Everything one form draws, across every level and a lot of seeds. */
  function sweep(grade: number) {
    const out = { widest: 0, biggest: 0, multiplied: 0, crossed: 0 };
    for (const skill of skillsFor("ngat", grade)) {
      for (let level = 1; level <= 4; level++) {
        for (const seed of SEEDS.slice(0, 80)) {
          const q = generateQuestion(skill, level, seed);
          if (grids.includes(skill.generator)) out.widest = Math.max(out.widest, boxes(q.figure!));
          if (skill.strand === "Quantitative Test") {
            const labels = [q.figure ?? "", ...(q.format.kind === "choice" ? (q.format.figures ?? []) : [])]
              .map(labelOf);
            const numbers = [...labels.join(" ").matchAll(/\d+/g)].map((m) => Number(m[0]));
            out.biggest = Math.max(out.biggest, ...numbers);
            if (MULTIPLIES.test(q.explanation)) out.multiplied++;
          }
          if (/two sets of lines crossing/.test(q.explanation)) out.crossed++;
        }
      }
    }
    return out;
  }

  const first = sweep(1);
  const fourth = sweep(4);

  it("keeps the first-grade form to four boxes, adding, and one set of lines", () => {
    // Nine boxes is not the four-box question made harder -- four show one
    // rule and ask you to apply it, nine show two and ask where they meet.
    expect(first.widest, "boxes in a grid").toBeLessThan(9);
    // Its numerals stay inside what a first grader counts with.
    expect(first.biggest, "the largest number printed").toBeLessThanOrEqual(20);
    expect(first.multiplied, "quantitative items that multiplied").toBe(0);
    expect(first.crossed, "patterns of two crossing line sets").toBe(0);
  });

  it("asks all three of those on the fourth-grade form", () => {
    // Without this the table above could be decoration: every assertion in the
    // test before this one also passes if a form simply never reaches its top.
    expect(fourth.widest, "boxes in a grid").toBe(9);
    expect(fourth.biggest, "the largest number printed").toBeGreaterThan(20);
    expect(fourth.multiplied, "quantitative items that multiplied").toBeGreaterThan(0);
    expect(fourth.crossed, "patterns of two crossing line sets").toBeGreaterThan(0);
  });
});
