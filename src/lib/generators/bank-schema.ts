import { z } from "zod";
import { BANKS, type BankName } from "./banks";

/**
 * Shape and sanity rules for the ELA content banks.
 *
 * These run in two places, and that is the point: the offline generator script
 * uses them to reject bad drafts before they reach the file, and banks.test.ts
 * uses them to guard what is already committed. A rule added here protects both
 * the next generated batch and every item already in the bank.
 */

export const nonEmpty = z.string().trim().min(1);

/** Three wrong options, all distinct from each other. */
export const distractors = z.array(nonEmpty).length(3);

/** Closed answer sets that a generator builds its distractors from. The
 *  answer must be one of these or the question renders without a right one. */
export const POS_TAGS = ["noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction"] as const;
export const FIGURES = ["simile", "metaphor", "personification", "hyperbole", "alliteration"] as const;
export const SENTENCE_TYPES = ["fragment", "run-on", "complete sentence"] as const;

/** No option may repeat, or a question shows the same choice twice. */
export const allDistinct = (values: string[]) =>
  new Set(values.map((v) => v.trim().toLowerCase())).size === values.length;

export const wordItem = z
  .tuple([nonEmpty, nonEmpty, distractors])
  .refine(([word, answer, wrong]) => allDistinct([word, answer, ...wrong]), {
    message: "word, answer and distractors must all differ",
  });

const homophone = z
  .object({ sentence: nonEmpty, answer: nonEmpty, options: z.array(nonEmpty).length(3), why: nonEmpty })
  .refine((h) => h.sentence.includes("___"), { message: "sentence must contain a ___ blank" })
  .refine((h) => h.options.includes(h.answer), { message: "options must contain the answer" })
  .refine((h) => allDistinct(h.options), { message: "options must be distinct" });

const posSentence = z
  .object({ s: nonEmpty, word: nonEmpty, pos: z.enum(POS_TAGS) })
  .refine((p) => p.s.includes(`**${p.word}**`), { message: "s must bold the target word" });

const affix = z
  .object({ affix: nonEmpty, meaning: nonEmpty, example: nonEmpty, distractors })
  .refine((a) => allDistinct([a.meaning, ...a.distractors]), { message: "meaning must differ from distractors" });

export const vocabTarget = z
  .object({ word: nonEmpty, meaning: nonEmpty, distractors })
  .refine((v) => allDistinct([v.meaning, ...v.distractors]), { message: "meaning must differ from distractors" });

export const answerAndWrong = z
  .object({ answer: nonEmpty, wrong: distractors })
  .refine((x) => allDistinct([x.answer, ...x.wrong]), { message: "answer must differ from wrong options" });

const passage = z
  .object({
    text: nonEmpty,
    mainIdea: nonEmpty,
    wrong: distractors,
    vocab: vocabTarget,
    vocabHard: vocabTarget,
    clue: z
      .object({ answer: nonEmpty, wrong: z.array(nonEmpty).length(2) })
      .refine((c) => allDistinct([c.answer, ...c.wrong]), { message: "clue options must differ" }),
    detail: answerAndWrong.and(z.object({ question: nonEmpty })),
    purpose: answerAndWrong,
    inference: answerAndWrong,
  })
  .refine((p) => allDistinct([p.mainIdea, ...p.wrong]), { message: "main idea must differ from wrong options" })
  // the clue question asks which part of the passage signals the meaning, so
  // the right answer has to actually be a span the student can find
  // only the keyed answer has to be findable; the wrong options are written as
  // shortened quotes on purpose, so they are deliberately not exact spans
  .refine((p) => p.text.includes(p.clue.answer), { message: "clue.answer must be a verbatim span of text" })
  .refine((p) => p.text.toLowerCase().includes(p.vocab.word.toLowerCase()), { message: "vocab.word must appear in text" })
  .refine((p) => p.text.toLowerCase().includes(p.vocabHard.word.toLowerCase()), { message: "vocabHard.word must appear in text" })
  .refine((p) => p.vocab.word.toLowerCase() !== p.vocabHard.word.toLowerCase(), { message: "vocab words must differ" });

export const sentenceItem = z
  .object({ s: nonEmpty, answer: nonEmpty, wrong: distractors, why: nonEmpty })
  .refine((i) => i.s.includes("___"), { message: "s must contain a ___ blank" })
  .refine((i) => allDistinct([i.answer, ...i.wrong]), { message: "answer must differ from wrong options" });

const closedSetItem = <T extends readonly [string, ...string[]]>(answers: T) =>
  z.object({ s: nonEmpty, answer: z.enum(answers), why: nonEmpty });

const capitalizationItem = z
  .object({ wrong: nonEmpty, right: nonEmpty, why: nonEmpty, accept: z.array(nonEmpty).optional() })
  .refine((c) => c.wrong !== c.right, { message: "wrong and right must differ" })
  .refine((c) => c.right !== c.right.toLowerCase(), { message: "right must contain capitals" });

const analogyItem = z
  .object({ a: nonEmpty, b: nonEmpty, c: nonEmpty, answer: nonEmpty, wrong: distractors, why: nonEmpty })
  .refine((x) => allDistinct([x.answer, ...x.wrong]), { message: "answer must differ from wrong options" });

const pluralItem = z
  .object({ sing: nonEmpty, answer: nonEmpty, wrong: distractors })
  // Two shapes are both valid here and they pull in opposite directions: an
  // invariant plural answers with the singular ("sheep" -> "sheep"), while a
  // regular one often uses the singular as a distractor. Requiring the answer
  // to differ from `sing` would ban the first; requiring it to match would ban
  // the second. So only the options themselves must be distinct.
  .refine((p) => allDistinct([p.answer, ...p.wrong]), { message: "answer must differ from wrong options" });

/** The per-item schema for each bank, keyed by bank name. */
export const ITEM_SCHEMA = {
  wordPairs: wordItem,
  homophones: homophone,
  posSentences: posSentence,
  affixes: affix,
  passages: passage,
  subjectVerbAgreement: sentenceItem,
  punctuation: sentenceItem,
  capitalization: capitalizationItem,
  sentenceType: closedSetItem(SENTENCE_TYPES),
  verbTense: sentenceItem,
  figurativeLanguage: closedSetItem(FIGURES),
  analogies: analogyItem,
  plurals: pluralItem,
  pronounAntecedent: sentenceItem,
} as const satisfies Record<BankName, z.ZodTypeAny>;

/**
 * The field that makes an item a duplicate of another. Two passages about the
 * same subject are near-useless to a student even when the wording differs, so
 * dedupe keys are chosen to catch that, not just exact repeats.
 */
export const dedupeKey: Record<BankName, (item: never) => string> = {
  wordPairs: (i: WordItemT) => i[0].toLowerCase(),
  homophones: (i: { sentence: string }) => i.sentence.toLowerCase(),
  posSentences: (i: { s: string }) => i.s.toLowerCase(),
  affixes: (i: { affix: string }) => i.affix.toLowerCase(),
  passages: (i: { mainIdea: string }) => i.mainIdea.toLowerCase(),
  subjectVerbAgreement: (i: { s: string }) => i.s.toLowerCase(),
  punctuation: (i: { s: string }) => i.s.toLowerCase(),
  capitalization: (i: { right: string }) => i.right.toLowerCase(),
  sentenceType: (i: { s: string }) => i.s.toLowerCase(),
  verbTense: (i: { s: string }) => i.s.toLowerCase(),
  figurativeLanguage: (i: { s: string }) => i.s.toLowerCase(),
  analogies: (i: { a: string; c: string }) => `${i.a}:${i.c}`.toLowerCase(),
  plurals: (i: { sing: string }) => i.sing.toLowerCase(),
  pronounAntecedent: (i: { s: string }) => i.s.toLowerCase(),
} as Record<BankName, (item: never) => string>;

type WordItemT = [string, string, string[]];

/**
 * A bank's items grouped by the pool a generator draws from. Only wordPairs
 * has more than one: "ancient" legitimately appears in both the synonym and
 * the antonym pool, so duplicates are judged within a pool, never across.
 */
export function poolsOf(bank: BankName): unknown[][] {
  return bank === "wordPairs"
    ? [BANKS.wordPairs.synonyms, BANKS.wordPairs.antonyms]
    : [BANKS[bank] as unknown[]];
}

/** Every item of one bank, as a flat list. */
export function itemsOf(bank: BankName): unknown[] {
  return poolsOf(bank).flat();
}

export interface Review {
  kept: unknown[];
  rejected: { key: string; why: string }[];
}

/**
 * Decide which drafted items may join a bank.
 *
 * Split out from the generator script so it can be tested without spending an
 * API call: this is the gate that decides what a model is allowed to put in
 * front of a student, and it should not be exercised for the first time during
 * a live run. An item is kept only if it satisfies the bank's schema and does
 * not collide with an existing item or an earlier item in the same batch.
 */
export function reviewDraft(bank: BankName, drafted: unknown[], priorKeys?: Iterable<string>): Review {
  const key = dedupeKey[bank] as (item: unknown) => string;
  return reviewItems(ITEM_SCHEMA[bank], key, drafted, priorKeys ?? poolsOf(bank).flat().map(key));
}

/**
 * The gate itself, with the bank lookup factored out: the exam banks in
 * exam-bank-schema.ts are a different set of names over the same rules, and a
 * second copy of this loop would be a second place for the rules to drift.
 */
export function reviewItems(
  schema: z.ZodTypeAny,
  key: (item: unknown) => string,
  drafted: unknown[],
  priorKeys: Iterable<string>,
): Review {
  const seen = new Set(priorKeys);
  const kept: unknown[] = [];
  const rejected: { key: string; why: string }[] = [];

  for (const item of drafted) {
    let k: string;
    try {
      k = key(item);
    } catch {
      rejected.push({ key: "?", why: "item is missing the fields that identify it" });
      continue;
    }
    const parsed = schema.safeParse(item);
    if (!parsed.success) {
      rejected.push({ key: k, why: parsed.error.issues.map((i) => i.message).join("; ") });
      continue;
    }
    if (seen.has(k)) {
      rejected.push({ key: k, why: "duplicate" });
      continue;
    }
    seen.add(k);
    kept.push(item);
  }
  return { kept, rejected };
}
