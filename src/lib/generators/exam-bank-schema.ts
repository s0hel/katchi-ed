import { z } from "zod";
import {
  allDistinct, answerAndWrong, distractors, nonEmpty, reviewItems, sentenceItem, vocabTarget,
  wordItem, type Review,
} from "./bank-schema";
import { EXAM_BANK_NAMES, examBankItems, type ExamBankName } from "./exam-banks";

/**
 * Shape and sanity rules for the CogAT and ISEE banks.
 *
 * The ELA banks' rules, reused where the shape is the same (a sentence with a
 * blank is a sentence with a blank, whoever is reading it) and extended where
 * the exam asks for something the ELA banks never do: a picture item has to
 * carry a picture, and an ISEE passage keys the author's tone.
 *
 * As with `bank-schema.ts`, these run in two places -- the offline generator
 * script rejects drafts with them, and exam-banks.test.ts holds what is already
 * committed to the same standard.
 */

/**
 * A picture: an emoji, a space, then the word it shows ("🧦 sock").
 *
 * The word is checked as strictly as the emoji. A first grader is not reading
 * either one alone -- a parent reads the word and the child looks at the
 * picture -- so an item missing half of that pairing is not usable.
 */
export const picture = nonEmpty.refine((v) => /^\P{L}+\s\p{L}/u.test(v), {
  message: 'must be an emoji followed by its word, e.g. "🧦 sock"',
});

const pictureAnalogy = z
  .object({ a: picture, b: picture, c: picture, answer: picture, wrong: z.array(picture).length(3), why: nonEmpty })
  .refine((i) => allDistinct([i.answer, ...i.wrong]), { message: "answer must differ from wrong options" })
  // c is the picture being reasoned about; if it is also an option the item
  // can be answered without noticing the relationship at all.
  .refine((i) => ![i.answer, ...i.wrong].includes(i.c), { message: "c must not appear among the options" });

const pictureGroup = z
  .object({ group: z.array(picture).length(3), answer: picture, wrong: z.array(picture).length(3), why: nonEmpty })
  .refine((i) => allDistinct([...i.group, i.answer, ...i.wrong]), {
    message: "every picture in the item must be different",
  });

/**
 * "Can you find it?": a sentence with one blank, answered with a picture.
 *
 * The sentence is read to the child, so it may use any words a grown-up can
 * say -- but every option has to be something a six-year-old can point at.
 * That rules out an answer like "greater" or "sick", however good the sentence
 * around it is.
 */
const pictureSentence = z
  .object({ s: nonEmpty, answer: picture, wrong: z.array(picture).length(3), why: nonEmpty })
  .refine((i) => i.s.includes("___"), { message: "s must contain a ___ blank" })
  .refine((i) => allDistinct([i.answer, ...i.wrong]), { message: "answer must differ from wrong options" });

/** An ISEE passage: four keyed question types over one piece of prose. */
const iseePassage = z
  .object({
    text: nonEmpty,
    mainIdea: nonEmpty,
    wrong: distractors,
    purpose: answerAndWrong,
    // Several of each, so the number of questions a passage supports is not
    // the number of passages.
    vocab: z.array(vocabTarget).min(2),
    details: z.array(answerAndWrong.and(z.object({ question: nonEmpty }))).min(2),
    inferences: z.array(answerAndWrong).min(2),
    tone: answerAndWrong,
  })
  .refine((p) => allDistinct([p.mainIdea, ...p.wrong]), { message: "main idea must differ from wrong options" })
  .refine((p) => p.vocab.every((v) => p.text.toLowerCase().includes(v.word.toLowerCase())), {
    message: "every vocab word must appear in text",
  })
  .refine((p) => allDistinct(p.vocab.map((v) => v.word)), { message: "vocab words must differ" })
  .refine((p) => allDistinct(p.details.map((d) => d.question)), { message: "detail questions must differ" })
  .refine((p) => allDistinct(p.inferences.map((i) => i.answer)), { message: "inferences must differ" })
  // A vocabulary-in-context item is only in context if the passage is long
  // enough to supply one.
  .refine((p) => p.text.split(/\s+/).length >= 80, { message: "text must run to at least 80 words" });

export const EXAM_ITEM_SCHEMA = {
  "cogat.pictureAnalogies": pictureAnalogy,
  "cogat.pictureGroups": pictureGroup,
  "cogat.sentenceCompletion": pictureSentence,
  "isee.synonyms": wordItem,
  "isee.sentenceCompletion": sentenceItem,
  "isee.passages": iseePassage,
} as const satisfies Record<ExamBankName, z.ZodTypeAny>;

/** What makes one item a repeat of another. */
export const examDedupeKey: Record<ExamBankName, (item: never) => string> = {
  "cogat.pictureAnalogies": (i: { a: string; c: string }) => `${i.a}:${i.c}`.toLowerCase(),
  "cogat.pictureGroups": (i: { group: string[] }) => i.group.join("|").toLowerCase(),
  "cogat.sentenceCompletion": (i: { s: string }) => i.s.toLowerCase(),
  // Two synonym items for the same prompt word are one item, however
  // differently the options are written.
  "isee.synonyms": (i: [string, string, string[]]) => i[0].toLowerCase(),
  "isee.sentenceCompletion": (i: { s: string }) => i.s.toLowerCase(),
  // Passages are deduped on subject matter, not wording: a second passage
  // making the same point is no practice at all.
  "isee.passages": (i: { mainIdea: string }) => i.mainIdea.toLowerCase(),
} as Record<ExamBankName, (item: never) => string>;

export function reviewExamDraft(
  bank: ExamBankName,
  drafted: unknown[],
  priorKeys?: Iterable<string>,
): Review {
  const key = examDedupeKey[bank] as (item: unknown) => string;
  return reviewItems(EXAM_ITEM_SCHEMA[bank], key, drafted, priorKeys ?? examBankItems(bank).map(key));
}

export { EXAM_BANK_NAMES, examBankItems };
export type { ExamBankName };
