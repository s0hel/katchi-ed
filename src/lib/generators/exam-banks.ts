import cogatRaw from "../../data/cogat-banks.json";
import iseeRaw from "../../data/isee-banks.json";
import type { SentenceItem, VocabTarget, WordItem } from "./banks";

/**
 * Content banks for the two entrance tests.
 *
 * Same bargain as the ELA banks: the reasoning items (figure matrices, number
 * series, quantitative comparison) are computed and effectively inexhaustible,
 * but anything that depends on *words* -- a synonym, a sentence completion, a
 * passage -- has to be written, reviewed, and stored. These files are the
 * ceiling on how much of each test a student can practise, and they are meant
 * to be extended by scripts/generate-ela-items.ts.
 *
 * They live apart from ela-banks.json because they are pitched at a different
 * target: CogAT items are read aloud to a six-year-old, and ISEE items are
 * written at the reading level of an admissions test for grades 7-8. Mixing
 * them into one file would put both out of reach of a reviewer asking "is this
 * right for the child in front of me?"
 */

/* ------------------------------------------------------------------ CogAT */

/**
 * A picture item. Each field is an emoji followed by its word, e.g. "🧦 sock".
 *
 * The real CogAT Level 7 shows pictures alone, because a first grader cannot
 * be assumed to read; a proctor reads the instructions. We keep the word
 * beside the picture on purpose: at home there is no proctor, the word lets a
 * parent read the item aloud, and a screen reader has something to announce.
 * The reasoning the item trains -- the relationship between the pictures -- is
 * unchanged.
 */
export interface PictureAnalogy {
  a: string;
  b: string;
  c: string;
  answer: string;
  wrong: string[];
  why: string;
}

/** Three pictures that share something, plus a fourth that belongs with them. */
export interface PictureGroup {
  group: string[];
  answer: string;
  wrong: string[];
  why: string;
}

/**
 * A sentence read aloud, answered with a picture -- the item CogAT calls "Can
 * you find it?". The sentence is the question and the pictures are the
 * options, so the child never has to read anything to answer.
 */
export interface PictureSentence {
  /** contains one ___ blank */
  s: string;
  answer: string;
  wrong: string[];
  why: string;
}

export interface CogatBanks {
  pictureAnalogies: PictureAnalogy[];
  pictureGroups: PictureGroup[];
  sentenceCompletion: PictureSentence[];
}

/* ------------------------------------------------------------------- ISEE */

/**
 * An ISEE reading passage with the four question types the Reading
 * Comprehension section actually asks. Deliberately close to the ELA
 * `Passage` shape without reusing it: ISEE keys tone and attitude, which the
 * ELA banks never ask about, and does not ask for the "which phrase is the
 * clue" item that the ELA context-clues skill is built on.
 *
 * Details, inferences and vocabulary come in sets, because the real section
 * asks four to six questions about every passage and because one question per
 * passage made the passage bank the ceiling on the skill: ten passages meant
 * ten possible questions, and a student met the same one every second
 * session. Main idea is paired with `purpose`, which the section asks as its
 * own question -- what a passage says and why it was written are different
 * questions about it. Tone stays single: an author has one attitude, and a
 * second tone question would be a worse question rather than another one.
 */
export interface IseePassage {
  text: string;
  mainIdea: string;
  wrong: string[];
  /** why the author wrote it, which the section asks separately from what it says */
  purpose: { answer: string; wrong: string[] };
  /** hard words, used in context, each appearing verbatim in `text` */
  vocab: VocabTarget[];
  details: { question: string; answer: string; wrong: string[] }[];
  inferences: { answer: string; wrong: string[] }[];
  /** the author's attitude toward the subject */
  tone: { answer: string; wrong: string[] };
}

export interface IseeBanks {
  /** [word, closest meaning, three wrong meanings] */
  synonyms: WordItem[];
  sentenceCompletion: SentenceItem[];
  passages: IseePassage[];
}

export const COGAT_BANKS = cogatRaw as CogatBanks;
export const ISEE_BANKS = iseeRaw as IseeBanks;

/** Bank names the offline generator script can extend, per exam. */
export const COGAT_BANK_NAMES = [
  "pictureAnalogies", "pictureGroups", "sentenceCompletion",
] as const satisfies readonly (keyof CogatBanks)[];

export const ISEE_BANK_NAMES = [
  "synonyms", "sentenceCompletion", "passages",
] as const satisfies readonly (keyof IseeBanks)[];

export type CogatBankName = (typeof COGAT_BANK_NAMES)[number];
export type IseeBankName = (typeof ISEE_BANK_NAMES)[number];

/** Every exam bank, addressed as "cogat.pictureAnalogies" / "isee.synonyms". */
export type ExamBankName =
  | `cogat.${CogatBankName}`
  | `isee.${IseeBankName}`;

export const EXAM_BANK_NAMES: ExamBankName[] = [
  ...COGAT_BANK_NAMES.map((n) => `cogat.${n}` as const),
  ...ISEE_BANK_NAMES.map((n) => `isee.${n}` as const),
];

export function examBankItems(name: ExamBankName): unknown[] {
  const [exam, bank] = name.split(".");
  const banks = (exam === "cogat" ? COGAT_BANKS : ISEE_BANKS) as unknown as Record<string, unknown[]>;
  return banks[bank] ?? [];
}

/**
 * The slice of a bank a level draws from.
 *
 * Every exam bank is stored easiest-first, so a lower tier sees only the front
 * of the bank and the top tier sees all of it -- the same ramp the ELA
 * generators use, factored out because six generators here need it.
 */
export function pool<T>(items: T[], level: number): T[] {
  if (level >= 4) return items;
  const share = level >= 3 ? 0.85 : level === 2 ? 0.65 : 0.45;
  return items.slice(0, Math.max(4, Math.ceil(items.length * share)));
}
