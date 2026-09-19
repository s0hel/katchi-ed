import raw from "../../data/ela-banks.json";

/**
 * ELA content banks.
 *
 * Unlike the math generators, which compute a question from arithmetic and so
 * are effectively inexhaustible, the ELA generators pick from curated content:
 * a seed chooses an item, it does not invent one. That makes these banks the
 * ceiling on ELA variety, so they live as reviewable data rather than as array
 * literals buried in generator bodies.
 *
 * New items are drafted offline by scripts/generate-ela-items.ts and reviewed
 * by a maintainer before they land. Nothing here is fetched at request time.
 */

/** [word, correct answer, three distractors] */
export type WordItem = [word: string, answer: string, distractors: string[]];

export interface Homophone {
  /** contains "___" where the answer goes */
  sentence: string;
  answer: string;
  /** includes the answer; the generator filters it out for distractors */
  options: string[];
  why: string;
}

export interface PosSentence {
  /** the target word is wrapped in ** ** */
  s: string;
  word: string;
  pos: string;
}

export interface Affix {
  affix: string;
  meaning: string;
  example: string;
  distractors: string[];
}

export interface VocabTarget {
  word: string;
  meaning: string;
  distractors: string[];
}

export interface Passage {
  text: string;
  mainIdea: string;
  /** plausible but wrong main ideas */
  wrong: string[];
  vocab: VocabTarget;
  vocabHard: VocabTarget;
  /** answer must be a verbatim span of `text` */
  clue: { answer: string; wrong: string[] };
  detail: { question: string; answer: string; wrong: string[] };
  purpose: { answer: string; wrong: string[] };
  inference: { answer: string; wrong: string[] };
}

/** Fill-in-the-blank or classify-the-sentence item. */
export interface SentenceItem {
  s: string;
  answer: string;
  wrong: string[];
  why: string;
}

/** Same, but the generator supplies distractors from a fixed closed set. */
export interface ClosedSetItem {
  s: string;
  answer: string;
  why: string;
}

export interface CapitalizationItem {
  /** the miscapitalized sentence shown to the student */
  wrong: string;
  right: string;
  why: string;
  /** other capitalizations a style guide would also allow */
  accept?: string[];
}

export interface AnalogyItem {
  a: string;
  b: string;
  c: string;
  answer: string;
  wrong: string[];
  why: string;
}

export interface PluralItem {
  sing: string;
  answer: string;
  wrong: string[];
}

export interface ElaBanks {
  wordPairs: Record<"synonyms" | "antonyms", WordItem[]>;
  homophones: Homophone[];
  posSentences: PosSentence[];
  affixes: Affix[];
  passages: Passage[];
  subjectVerbAgreement: SentenceItem[];
  punctuation: SentenceItem[];
  capitalization: CapitalizationItem[];
  sentenceType: ClosedSetItem[];
  verbTense: SentenceItem[];
  figurativeLanguage: ClosedSetItem[];
  analogies: AnalogyItem[];
  plurals: PluralItem[];
  pronounAntecedent: SentenceItem[];
}

/** Bank names the offline generator script can extend. */
export const BANK_NAMES = [
  "wordPairs", "homophones", "posSentences", "affixes", "passages",
  "subjectVerbAgreement", "punctuation", "capitalization", "sentenceType",
  "verbTense", "figurativeLanguage", "analogies", "plurals", "pronounAntecedent",
] as const satisfies readonly (keyof ElaBanks)[];

export type BankName = (typeof BANK_NAMES)[number];

export const BANKS = raw as ElaBanks;
