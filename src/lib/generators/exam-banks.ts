import cogatRaw from "../../data/cogat-banks.json";
import iseeRaw from "../../data/isee-banks.json";
import ngatRaw from "../../data/ngat-banks.json";
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
 * target: CogAT items are read aloud to a six-year-old, NGAT items are looked
 * at by a fourth grader and never read to them at all, and ISEE items are
 * written at the reading level of an admissions test for grades 7-8. Mixing
 * them into one file would put all three out of reach of a reviewer asking "is
 * this right for the child in front of me?"
 */

/* ------------------------------------------------------------------ CogAT */

/**
 * A picture item. Each field is an emoji followed by its word, e.g. "🧦 sock".
 *
 * The real CogAT Level 7 shows pictures alone, because a first grader cannot
 * be assumed to read; a proctor reads the instructions. So does ours -- the
 * word is never drawn beside the picture. It is still carried in the bank
 * because everything around the item needs it: the hint a parent reads aloud,
 * the answer key, and what a screen reader announces.
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

/* ------------------------------------------------------------------- NGAT */

/**
 * A Naglieri verbal item: six pictures, five of which share one idea.
 *
 * The child picks the one that does not. That is the whole of the NGAT's
 * verbal test -- one item type, asked over and over with a harder idea each
 * time -- and it is a different question from CogAT's classification, which
 * shows three that belong and asks for a fourth. Here nothing is given as an
 * example: the group and the odd one out arrive together, and finding the idea
 * IS the item.
 *
 * `kind` is ours, not the test's. Five pictures can share what they *are* (all
 * insects) or what they *do or have* (all give off light), and the second is
 * reliably the harder reading of a picture -- so they are two skills in the
 * catalog rather than one that ramps between them invisibly.
 */
export interface OddOneOut {
  kind: "category" | "property";
  /** what the five share, as the explanation says it: "they are all birds" */
  concept: string;
  /** five pictures that share the concept */
  group: string[];
  /** the sixth, which does not */
  odd: string;
  /** why the odd one is out, in one sentence */
  why: string;
}

export interface NgatBanks {
  oddOneOut: OddOneOut[];
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
export const NGAT_BANKS = ngatRaw as NgatBanks;
export const ISEE_BANKS = iseeRaw as IseeBanks;

/** Bank names the offline generator script can extend, per exam. */
export const COGAT_BANK_NAMES = [
  "pictureAnalogies", "pictureGroups", "sentenceCompletion",
] as const satisfies readonly (keyof CogatBanks)[];

export const NGAT_BANK_NAMES = [
  "oddOneOut",
] as const satisfies readonly (keyof NgatBanks)[];

export const ISEE_BANK_NAMES = [
  "synonyms", "sentenceCompletion", "passages",
] as const satisfies readonly (keyof IseeBanks)[];

export type CogatBankName = (typeof COGAT_BANK_NAMES)[number];
export type NgatBankName = (typeof NGAT_BANK_NAMES)[number];
export type IseeBankName = (typeof ISEE_BANK_NAMES)[number];

/** Every exam bank, addressed as "cogat.pictureAnalogies" / "isee.synonyms". */
export type ExamBankName =
  | `cogat.${CogatBankName}`
  | `ngat.${NgatBankName}`
  | `isee.${IseeBankName}`;

export const EXAM_BANK_NAMES: ExamBankName[] = [
  ...COGAT_BANK_NAMES.map((n) => `cogat.${n}` as const),
  ...NGAT_BANK_NAMES.map((n) => `ngat.${n}` as const),
  ...ISEE_BANK_NAMES.map((n) => `isee.${n}` as const),
];

const BANKS_BY_EXAM: Record<string, unknown> = {
  cogat: COGAT_BANKS,
  ngat: NGAT_BANKS,
  isee: ISEE_BANKS,
};

export function examBankItems(name: ExamBankName): unknown[] {
  const [exam, bank] = name.split(".");
  const banks = BANKS_BY_EXAM[exam] as Record<string, unknown[]> | undefined;
  return banks?.[bank] ?? [];
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
