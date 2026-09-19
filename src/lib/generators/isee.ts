import { choice, fixedChoice, round, str, type GeneratorFn } from "./helpers";
import { ISEE_BANKS, pool } from "./exam-banks";
import type { Rng } from "../rng";

/**
 * ISEE practice at the Middle Level -- the form a sixth grader sits when
 * applying for seventh or eighth grade.
 *
 * The exam has five sections and four of them are scored: Verbal Reasoning
 * (synonyms and single-blank sentence completion -- no analogies; those belong
 * to the SSAT), Quantitative Reasoning (word problems and quantitative
 * comparisons), Reading Comprehension, and Mathematics Achievement. The essay
 * is sent to schools unscored, so there is nothing here to grade against.
 *
 * Mathematics Achievement is not reimplemented: it is the same arithmetic,
 * pre-algebra and geometry the math catalog already generates, so those skills
 * are catalog entries pointing at the existing math generators. What lives in
 * this file is the part of the ISEE that is genuinely its own -- the verbal
 * items, the reading section, and quantitative comparison, which no school
 * curriculum teaches because it exists only on admissions tests.
 */

/* ------------------------------------------------------- verbal reasoning */

const synonyms: GeneratorFn = (rng, level) => {
  const [word, answer, distractors] = rng.pick(pool(ISEE_BANKS.synonyms, level));
  return choice(rng, {
    instructions: "Select the word that most nearly means the word in capitals.",
    stem: `**${word.toUpperCase()}**`,
    answer,
    distractors: [...distractors],
    explanation: `**${word}** means "${answer}".`,
    hint: "Say the word in a sentence you already know, then look for the option that could replace it.",
  });
};

const sentenceCompletion: GeneratorFn = (rng, level) => {
  const item = rng.pick(pool(ISEE_BANKS.sentenceCompletion, level));
  return choice(rng, {
    instructions: "Select the word that best completes the sentence.",
    stem: item.s.replace("___", "**___**"),
    answer: item.answer,
    distractors: [...item.wrong],
    explanation: item.why,
    hint: "Decide what the sentence needs before you read the options — then find the option closest to it.",
  });
};

/* ------------------------------------------------- quantitative reasoning */

/**
 * Quantitative comparison: two quantities, and the question is which is
 * bigger rather than what either equals.
 *
 * The keyed answer is never written by hand. Each quantity is a function of
 * the unknown, evaluated across every value the given information allows; the
 * comparison is "cannot be determined" exactly when that sweep disagrees with
 * itself. An item whose fourth option is a judgement call is an item that
 * teaches the wrong lesson, so the fourth option is a computation.
 */
interface Quantity {
  label: string;
  of: (x: number) => number;
}

const QC_CHOICES = [
  "The quantity in Column A is greater",
  "The quantity in Column B is greater",
  "The two quantities are equal",
  "The relationship cannot be determined from the information given",
];

function compare(a: Quantity, b: Quantity, domain: number[]): string {
  const signs = new Set(domain.map((x) => Math.sign(round6(a.of(x)) - round6(b.of(x)))));
  if (signs.size > 1) return QC_CHOICES[3];
  const [sign] = [...signs];
  return sign > 0 ? QC_CHOICES[0] : sign < 0 ? QC_CHOICES[1] : QC_CHOICES[2];
}

/** Float noise must not decide a comparison: 0.1 + 0.2 is 0.3 here. */
function round6(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}

/** A fixed pair of arithmetic expressions -- no unknown, so one sweep value. */
function constantPair(rng: Rng, level: number): { a: Quantity; b: Quantity; given?: string; domain: number[] } {
  const kind = level <= 1 ? rng.pick(["sum", "product"]) : rng.pick(["sum", "product", "percent", "fraction"]);
  if (kind === "sum") {
    const [p, q, r] = [rng.int(12, 60), rng.int(12, 60), rng.int(12, 60)];
    const s = rng.bool() ? p + q - r : p + q - r + rng.int(-3, 3);
    return {
      a: { label: `${p} + ${q} − ${r}`, of: () => p + q - r },
      b: { label: `${s}`, of: () => s },
      domain: [0],
    };
  }
  if (kind === "product") {
    const [p, q] = [rng.int(3, 12), rng.int(3, 12)];
    const [u, v] = rng.bool() ? [q, p] : [rng.int(3, 12), rng.int(3, 12)];
    return {
      a: { label: `${p} × ${q}`, of: () => p * q },
      b: { label: `${u} × ${v}`, of: () => u * v },
      domain: [0],
    };
  }
  if (kind === "percent") {
    const [p, whole] = [rng.pick([20, 25, 30, 40, 50, 60, 75]), rng.pick([40, 60, 80, 120, 200])];
    const [q, other] = [rng.pick([10, 15, 20, 25, 50]), rng.pick([60, 80, 150, 240])];
    return {
      a: { label: `${p}% of ${whole}`, of: () => (p / 100) * whole },
      b: { label: `${q}% of ${other}`, of: () => (q / 100) * other },
      domain: [0],
    };
  }
  // Both wholes are multiples of their denominator, so each column is a whole
  // number and the comparison is about the fractions, not about rounding.
  const [n, d] = [rng.int(1, 5), rng.pick([2, 3, 4, 5, 6, 8])];
  const [m, e] = [rng.int(1, 5), rng.pick([2, 3, 4, 5, 6, 8])];
  const whole = d * rng.int(3, 9);
  const other = e * rng.int(3, 9);
  return {
    a: { label: `${n}/${d} of ${whole}`, of: () => (n / d) * whole },
    b: { label: `${m}/${e} of ${other}`, of: () => (m / e) * other },
    domain: [0],
  };
}

/** A pair built on an unknown, which may or may not settle the comparison. */
function variablePair(rng: Rng, level: number): { a: Quantity; b: Quantity; given: string; domain: number[] } {
  const style = rng.pick(level >= 4 ? ["open", "open", "bounded", "pinned"] : ["pinned", "pinned", "open"]);

  if (style === "pinned") {
    // The unknown is given, so both columns evaluate. Column B is built to
    // land near Column A -- a comparison that is obvious at a glance tests
    // nothing.
    const x = rng.int(3, 9);
    const [p, q] = [rng.int(2, 9), rng.int(2, 20)];
    const aValue = p * x + q;
    const coefficient = rng.int(2, 9);
    const constant = aValue - coefficient * x + rng.int(-2, 2);
    return {
      given: `x = ${x}`,
      a: { label: `${p}x + ${q}`, of: (v) => p * v + q },
      b: {
        label: `${coefficient}x ${constant < 0 ? "−" : "+"} ${Math.abs(constant)}`,
        of: (v) => coefficient * v + constant,
      },
      domain: [x],
    };
  }

  if (style === "bounded") {
    const lo = rng.int(2, 5);
    const hi = lo + rng.int(3, 6);
    const k = rng.int(lo, hi);
    return {
      given: `${lo} < n < ${hi}`,
      a: { label: "n", of: (v) => v },
      b: { label: `${k}`, of: () => k },
      domain: Array.from({ length: hi - lo - 1 }, (_, i) => lo + 1 + i),
    };
  }

  // "open": a linear quantity and a steeper one, which cross somewhere in the
  // positive integers -- the classic case where neither column always wins.
  const [p, q] = [rng.int(2, 4), rng.int(3, 9)];
  return {
    given: "n is a positive integer",
    a: { label: `${p}n`, of: (v) => p * v },
    b: { label: `n + ${q}`, of: (v) => v + q },
    domain: [1, 2, 3, 4, 5, 8, 12, 40],
  };
}

const quantitativeComparison: GeneratorFn = (rng, level) => {
  const useVariable = level >= 3 || (level === 2 && rng.bool(0.4));
  const pair = useVariable ? variablePair(rng, level) : constantPair(rng, level);

  const answer = compare(pair.a, pair.b, pair.domain);
  const given = "given" in pair && pair.given ? `${pair.given}\n\n` : "";
  const values = pair.domain.map((x) => ({ x, a: pair.a.of(x), b: pair.b.of(x) }));

  let explanation: string;
  if (answer === QC_CHOICES[3]) {
    // Two values that order the columns differently. "Greater" and "equal" are
    // as much a disagreement as "greater" and "less", so the second case is
    // whichever value disagrees with the first -- not a hunt for a strict flip
    // that a borderline item may not contain.
    const [first] = values;
    const order = (v: { a: number; b: number }) => Math.sign(round6(v.a) - round6(v.b));
    const second = values.find((v) => order(v) !== order(first))!;
    const n = varName(pair);
    const say = (v: { x: number; a: number; b: number }) =>
      `${n} = ${v.x} makes Column A ${round(v.a)} and Column B ${round(v.b)}`;
    explanation =
      `It depends on the value: ${say(first)}, while ${say(second)}. ` +
      `Two different orderings means the relationship cannot be determined.`;
  } else {
    const [first] = values;
    const verdict =
      answer === QC_CHOICES[2] ? "the two are equal" : answer === QC_CHOICES[0] ? "Column A is greater" : "Column B is greater";
    explanation = `Column A works out to ${round(first.a)} and Column B to ${round(first.b)}, so ${verdict}.`;
  }

  return fixedChoice({
    instructions: "Compare the quantity in Column A with the quantity in Column B.",
    stem: `${given}| Column A | Column B |\n| --- | --- |\n| ${pair.a.label} | ${pair.b.label} |`,
    choices: QC_CHOICES,
    answer,
    explanation,
    hint: "Work out both columns before you look at the options. If a letter could stand for more than one number, try two of them.",
  });
};

function varName(pair: { given?: string }): string {
  return pair.given?.includes("x") ? "x" : "n";
}

/* ----------------------------------------------------- reading comprehension */

/** Which question the Reading Comprehension skill asks of its passage. */
type Ask = "main-idea" | "detail" | "vocabulary" | "inference" | "tone";

const reading: GeneratorFn = (rng, level, params) => {
  const ask = str(params, "ask", "main-idea") as Ask;
  const p = rng.pick(pool(ISEE_BANKS.passages, level));
  const passage = `${p.text}\n\n`;

  if (ask === "detail") {
    return choice(rng, {
      instructions: "Answer the question using the passage.",
      stem: `${passage}${p.detail.question}`,
      answer: p.detail.answer,
      distractors: [...p.detail.wrong],
      explanation: `The passage states this directly. The other options change a detail the passage gives, or add one it never gives.`,
      hint: "Find the sentence the question is about and read it again before you choose.",
    });
  }

  if (ask === "vocabulary") {
    return choice(rng, {
      instructions: "Use the passage to determine the meaning.",
      stem: `${passage}As it is used in the passage, **${p.vocab.word}** most nearly means:`,
      answer: p.vocab.meaning,
      distractors: [...p.vocab.distractors],
      explanation: `In this passage **${p.vocab.word}** means "${p.vocab.meaning}". The other options are meanings the word can carry elsewhere, or meanings of words it resembles.`,
      hint: "Read the sentence with each option in place of the word. Only one keeps the passage's meaning intact.",
    });
  }

  if (ask === "inference") {
    return choice(rng, {
      instructions: "Draw a conclusion from the passage.",
      stem: `${passage}It can be inferred from the passage that:`,
      answer: p.inference.answer,
      distractors: [...p.inference.wrong],
      explanation: `The passage does not say this outright, but it follows from what it does say. The other options go further than the passage supports.`,
      hint: "An inference is one step beyond the text — never two.",
    });
  }

  if (ask === "tone") {
    return choice(rng, {
      instructions: "Identify the author's attitude.",
      stem: `${passage}The author's attitude toward the subject can best be described as:`,
      answer: p.tone.answer,
      distractors: [...p.tone.wrong],
      explanation: `The author's word choices point to a ${p.tone.answer.toLowerCase()} attitude. Tone options that are stronger than the passage — hostile, awed, dismissive — are usually wrong on this test.`,
      hint: "Look at the adjectives the author chose. Tone lives in word choice, not in the facts.",
    });
  }

  return choice(rng, {
    instructions: "Identify the main idea.",
    stem: `${passage}The passage is primarily about:`,
    answer: p.mainIdea,
    distractors: [...p.wrong],
    explanation: `The main idea has to cover the whole passage: ${p.mainIdea} The other options are true details, or claims the passage never makes.`,
    hint: "A main idea that only fits one paragraph is a detail, not the main idea.",
  });
};

export const iseeGenerators: Record<string, GeneratorFn> = {
  "isee-synonyms": synonyms,
  "isee-sentence-completion": sentenceCompletion,
  "isee-quantitative-comparison": quantitativeComparison,
  "isee-reading": reading,
};
