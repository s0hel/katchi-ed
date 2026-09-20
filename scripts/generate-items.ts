/**
 * Curation script (run by a maintainer, not at runtime).
 *
 * Drafts new content-bank items with Claude and merges the ones that survive
 * validation into src/data/. Banks are addressed by name: an ELA bank as
 * itself ("passages"), an exam bank qualified by its test ("isee.passages").
 *
 *   export ANTHROPIC_API_KEY=...            # or: ant auth login
 *   npx vite-node scripts/generate-items.ts -- --bank passages --count 12
 *   npx vite-node scripts/generate-items.ts -- --bank isee.synonyms --count 20
 *   npx vite-node scripts/generate-items.ts -- --bank all --count 8 --dry-run
 *
 * Why offline: a question is graded by re-deriving it server-side from
 * (skill, level, seed), which only works because generation is deterministic.
 * Calling a model at request time would break that, put an unreviewed passage
 * in front of a child, and add latency to every question. So the model writes
 * into the bank ahead of time, a maintainer reads the diff, and the runtime
 * stays exactly as pure as it was.
 *
 * Nothing is written until every item passes the same schema the app's tests
 * enforce (src/lib/generators/bank-schema.ts). Rejects are printed, not fixed:
 * a bad draft is cheap to regenerate and expensive to half-repair.
 */
import { readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { BANK_NAMES, type BankName } from "../src/lib/generators/banks";
import { reviewDraft, dedupeKey, poolsOf, POS_TAGS, FIGURES, SENTENCE_TYPES } from "../src/lib/generators/bank-schema";
import { EXAM_BANK_NAMES, type ExamBankName } from "../src/lib/generators/exam-banks";
import { reviewExamDraft, examDedupeKey } from "../src/lib/generators/exam-bank-schema";

/** Every bank this script can extend, and the file it lives in. */
type AnyBankName = BankName | ExamBankName;

const ALL_BANKS: AnyBankName[] = [...BANK_NAMES, ...EXAM_BANK_NAMES];

const FILE_OF = (bank: AnyBankName): string =>
  bank.startsWith("cogat.")
    ? "src/data/cogat-banks.json"
    : bank.startsWith("isee.")
      ? "src/data/isee-banks.json"
      : "src/data/ela-banks.json";

/** The key inside its file: "isee.synonyms" is stored as `synonyms`. */
const FIELD_OF = (bank: AnyBankName): string => bank.split(".").pop()!;

const isExam = (bank: AnyBankName): bank is ExamBankName => bank.includes(".");
const MODEL = "claude-opus-5";

/**
 * How many items to ask for in one request. A passage object is an order of
 * magnitude larger than a plurals item -- ten of them overflow the output
 * budget and come back as truncated JSON -- so large-item banks are asked in
 * small batches and the results accumulated.
 */
const BATCH_LIMIT: Partial<Record<AnyBankName, number>> = { passages: 3, "isee.passages": 2 };
const DEFAULT_BATCH = 10;

/* ------------------------------------------------------------ wire schemas */

/**
 * What the model is asked to return. These are the bank shapes with the
 * cross-field rules left off, because a JSON schema cannot express "this
 * string must be a verbatim span of that one" -- those are checked after the
 * response lands, by ITEM_SCHEMA, which is the same check the tests run.
 */
const three = z.array(z.string()).length(3);
const vocab = z.object({ word: z.string(), meaning: z.string(), distractors: three });
const answerWrong = { answer: z.string(), wrong: three };

const picture = z.string().describe('an emoji followed by its word, e.g. "🧦 sock"');

const WIRE: Record<AnyBankName, z.ZodTypeAny> = {
  wordPairs: z.object({ word: z.string(), answer: z.string(), distractors: three }),
  homophones: z.object({ sentence: z.string(), answer: z.string(), options: z.array(z.string()).length(3), why: z.string() }),
  posSentences: z.object({ s: z.string(), word: z.string(), pos: z.enum(POS_TAGS) }),
  affixes: z.object({ affix: z.string(), meaning: z.string(), example: z.string(), distractors: three }),
  passages: z.object({
    text: z.string(),
    mainIdea: z.string(),
    wrong: three,
    vocab,
    vocabHard: vocab,
    clue: z.object({ answer: z.string(), wrong: z.array(z.string()).length(2) }),
    detail: z.object({ question: z.string(), ...answerWrong }),
    purpose: z.object(answerWrong),
    inference: z.object(answerWrong),
  }),
  subjectVerbAgreement: z.object({ s: z.string(), ...answerWrong, why: z.string() }),
  punctuation: z.object({ s: z.string(), ...answerWrong, why: z.string() }),
  capitalization: z.object({ wrong: z.string(), right: z.string(), why: z.string() }),
  sentenceType: z.object({ s: z.string(), answer: z.enum(SENTENCE_TYPES), why: z.string() }),
  verbTense: z.object({ s: z.string(), ...answerWrong, why: z.string() }),
  figurativeLanguage: z.object({ s: z.string(), answer: z.enum(FIGURES), why: z.string() }),
  analogies: z.object({ a: z.string(), b: z.string(), c: z.string(), ...answerWrong, why: z.string() }),
  plurals: z.object({ sing: z.string(), ...answerWrong }),
  pronounAntecedent: z.object({ s: z.string(), ...answerWrong, why: z.string() }),

  "cogat.pictureAnalogies": z.object({
    a: picture, b: picture, c: picture, answer: picture, wrong: z.array(picture).length(3), why: z.string(),
  }),
  "cogat.pictureGroups": z.object({
    group: z.array(picture).length(3), answer: picture, wrong: z.array(picture).length(3), why: z.string(),
  }),
  "cogat.sentenceCompletion": z.object({
    s: z.string(), answer: picture, wrong: z.array(picture).length(3), why: z.string(),
  }),

  "isee.synonyms": z.object({ word: z.string(), answer: z.string(), distractors: three }),
  "isee.sentenceCompletion": z.object({ s: z.string(), ...answerWrong, why: z.string() }),
  "isee.passages": z.object({
    text: z.string(),
    mainIdea: z.string(),
    wrong: three,
    purpose: z.object(answerWrong),
    vocab: z.array(vocab).length(3),
    details: z.array(z.object({ question: z.string(), ...answerWrong })).length(3),
    inferences: z.array(z.object(answerWrong)).length(2),
    tone: z.object(answerWrong),
  }),
};

/** What each bank is for, and the rules a draft has to respect. */
const BRIEF: Record<AnyBankName, string> = {
  wordPairs:
    "Vocabulary items. `word` is the prompt word; `answer` is a true SYNONYM of it; the three distractors must be plainly wrong, not near-misses or antonyms of each other.",
  homophones:
    "Commonly confused words. `sentence` must contain exactly one `___` blank. `options` holds three spellings INCLUDING the correct one. `why` explains the distinction in one sentence.",
  posSentences:
    "Part-of-speech identification. `s` is a sentence with the target word wrapped in double asterisks, e.g. `The **curious** fox ran.` `word` must match the bolded text exactly and `pos` must be its part of speech in that sentence.",
  affixes:
    "Prefix and suffix meanings. `example` must be a real word that actually uses `affix` with the meaning given. Distractors are meanings of OTHER affixes.",
  passages:
    "Reading-comprehension passages. `text` is 55-90 words of original, factually accurate expository prose -- never quoted or adapted from a published source. Then: `mainIdea` plus three wrong main ideas that are tempting but too narrow, too broad, or off-point; `vocab` (an easier word) and `vocabHard` (a harder word), each a DIFFERENT word that literally appears in `text`, with its in-context meaning and three wrong meanings; `clue.answer` must be an EXACT, character-for-character span copied from `text` that signals what the `vocabHard` word means, with two other spans that do not; `detail` (a question plus the supporting detail and three wrong ones); `purpose`; `inference` (something the passage implies without stating).",
  subjectVerbAgreement:
    "Subject-verb agreement. `s` contains one `___`. The tricky part should be a phrase between the subject and the verb, a collective noun, or an indefinite pronoun.",
  punctuation:
    "Punctuation choice. `s` contains one `___` (or two, for paired commas). `answer` is the mark itself, e.g. `,` or `;` or `:`; keep `no punctuation` as one of the wrong options where it fits.",
  capitalization:
    "Capitalization repair. `wrong` is a sentence written in lower case with real capitalization errors; `right` is the same sentence corrected. They must differ only in capitalization.",
  sentenceType:
    "Fragment / run-on / complete sentence classification. `s` is the sentence to classify.",
  verbTense:
    "Verb tense choice. `s` contains one `___` and a time cue that makes exactly one tense correct.",
  figurativeLanguage:
    "Figure-of-speech identification. `s` is a short vivid sentence using exactly one of the listed figures.",
  analogies:
    "Word analogies in the form a : b :: c : answer. State the relationship in `why`. The three wrong options must be related to `c` but wrong for the relationship.",
  plurals:
    "Plural forms. `answer` is the correct plural of `sing`. Every wrong option must be genuinely incorrect -- never list a second acceptable plural (e.g. `cactuses` is a real plural of `cactus`, so it cannot be a distractor).",
  pronounAntecedent:
    "Pronoun-antecedent agreement. `s` contains one `___` and an antecedent whose number is easy to mistake.",

  "cogat.pictureAnalogies":
    "CogAT Level 7 picture analogies, for a SIX-YEAR-OLD. Every picture field is an emoji, a space, then the word it shows: `🧦 sock`. The item reads \"a goes with b; what goes with c the same way?\", so the a-b relationship must be one a first grader can state out loud (what it is worn on, where it lives, what it turns into, what it gives us, what it is used on). Use only emoji a child recognises instantly. `c` must NOT appear among the options. `why` states the relationship in one plain sentence.",
  "cogat.pictureGroups":
    "CogAT Level 7 picture classification, for a SIX-YEAR-OLD. `group` is three pictures that share ONE obvious category; `answer` is a fourth that belongs; the three wrong options must be outside the category in a way a first grader can see. Every picture is an emoji, a space, then its word. Say the category in `why`, and where a wrong option is a near miss (a carrot among fruit), say why it does not belong.",
  "cogat.sentenceCompletion":
    "CogAT Level 7 sentence completion -- the \"Can you find it?\" item -- read ALOUD to a six-year-old, who answers by pointing at a PICTURE. `s` holds one `___`. Every option is an emoji, a space, then its word, and must be a thing a child can point at: no answer like `greater`, `sick` or `loud`, however good the sentence is. The sentence may use any words a grown-up can say; the reasoning is what should make it hard -- what an object is for, where something lives, what an animal gives us, what you wear when.",

  "isee.synonyms":
    "ISEE Middle Level synonyms (sat by sixth graders). `word` is a single word at the level of `reluctant`, `candid` or `meticulous`; `answer` is its closest meaning in one or two plain words; the three distractors must be plainly wrong -- not shades of the same meaning, and not the exact opposite of each other. Avoid words a sixth grader would never meet in a book.",
  "isee.sentenceCompletion":
    "ISEE Middle Level sentence completion. `s` holds one `___` in a sentence whose OWN WORDS decide the answer: a contrast signal (although, rather than, but), a definition after a colon or semicolon, or a cause introduced by because. A sixth grader should be able to predict the blank before reading the options. `why` names the signal, it does not restate the answer.",
  "isee.passages":
    "ISEE Middle Level reading passages. `text` is 110-160 words of original expository prose -- never adapted from a published source -- at the reading level of a good sixth-grade nonfiction book, on history, science, or the arts. The real section asks four to six questions about every passage, so write a set of each kind, all answerable from this passage alone: `mainIdea` plus three wrong ones that are too narrow, too broad, or unsupported; `purpose`, why the author wrote it (to explain, to correct a common account, to show how something came about) with three purposes the passage does not have; three `vocab` entries, each a DIFFERENT hard word appearing verbatim in `text`, with its in-context meaning and three wrong meanings; three `details`, each a question answerable only from the passage and each about a different part of it; two `inferences`, each one step beyond the text and no further; and `tone`, the author's attitude as a single adjective (Measured, Admiring, Wry, Analytical) with three attitudes the passage does not support. Tone options should not all be extreme. Main idea and tone are single because a passage has one of each; a second would be a worse question rather than another one.",
};

const SYSTEM = `You write practice items for Katchi, a K-8 math and language-arts practice app.

Rules that matter more than volume:
- Every item must be factually correct and unambiguous. Exactly one option can be defensible as the answer; if a distractor is even arguably right, the item is broken.
- Write original prose. Never reproduce or lightly reword text from a published source.
- Keep the reading level appropriate for grades 2-8 and the subject matter suitable for children.
- Match the voice of the existing items: plain, concrete, and specific. No cutesy framing.
- Vary the topics. Do not cluster several items around the same subject.
- Explanations ("why") teach the rule in one sentence. They do not restate the answer.`;

/* ------------------------------------------------------------------- utils */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

type Banks = Record<string, unknown> & {
  wordPairs: { synonyms: unknown[]; antonyms: unknown[] };
};

/** Existing items, shown to the model so it writes around them, not over them. */
function existing(banks: Banks, bank: AnyBankName, pool: string): unknown[] {
  return bank === "wordPairs"
    ? (banks.wordPairs[pool as "synonyms" | "antonyms"] ?? [])
    : ((banks[FIELD_OF(bank)] as unknown[]) ?? []);
}

/** The gate an item has to pass, whichever family of banks it belongs to. */
function review(bank: AnyBankName, drafted: unknown[], priorKeys: Set<string>) {
  return isExam(bank)
    ? reviewExamDraft(bank, drafted, priorKeys)
    : reviewDraft(bank, drafted, priorKeys);
}

function keyOf(bank: AnyBankName): (item: unknown) => string {
  return (isExam(bank) ? examDedupeKey[bank] : dedupeKey[bank]) as (item: unknown) => string;
}

async function draft(bank: AnyBankName, pool: string, count: number, prior: unknown[]) {
  const client = new Anthropic();
  const wire = WIRE[bank];
  const brief =
    bank === "wordPairs" && pool === "antonyms"
      ? BRIEF.wordPairs.replace("a true SYNONYM of it", "a true ANTONYM of it")
      : BRIEF[bank];

  // Streamed, and read back with finalMessage(): the SDK refuses a
  // non-streaming request with an output budget this large, and a passage
  // batch genuinely needs the room. messages.parse() is avoided for a second
  // reason -- it throws on truncated JSON before the stop reason can be read,
  // turning "you asked for too many items" into an unexplained syntax error.
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    system: SYSTEM,
    thinking: { type: "adaptive" },
    output_config: { format: zodOutputFormat(z.object({ items: z.array(wire) })) },
    messages: [
      {
        role: "user",
        content: `Write ${count} new items for the "${bank}"${bank === "wordPairs" ? ` (${pool})` : ""} bank.

${brief}

These ${prior.length} items already exist. Do not repeat them, their prompt words, or their subject matter:

${JSON.stringify(prior, null, 2)}

Return ${count} items that are clearly distinct from the above.`,
      },
    ],
  });
  const response = await stream.finalMessage();

  if (response.stop_reason === "refusal") {
    throw new Error(`model declined: ${response.stop_details?.explanation ?? "no explanation"}`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error(`response was cut off at max_tokens -- ask for fewer than ${count} items per batch`);
  }

  const body = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch (err) {
    throw new Error(`model returned unparseable JSON: ${(err as Error).message}`);
  }
  const parsed = z.object({ items: z.array(wire) }).safeParse(json);
  if (!parsed.success) {
    throw new Error(`response did not match the requested shape: ${parsed.error.issues.slice(0, 3).map((i) => i.message).join("; ")}`);
  }
  return parsed.data.items;
}

/**
 * Both synonym banks are stored as [word, answer, distractors] tuples, which
 * the model cannot return directly -- a JSON schema names its fields. It
 * drafts an object and the tuple is assembled here.
 */
function toStored(bank: AnyBankName, item: Record<string, unknown>): unknown {
  return bank === "wordPairs" || bank === "isee.synonyms"
    ? [item.word, item.answer, item.distractors]
    : item;
}

async function harvestBank(banks: Banks, bank: AnyBankName, count: number, dry: boolean) {
  const pools = bank === "wordPairs" ? ["synonyms", "antonyms"] : [""];

  for (const pool of pools) {
    const label = bank + (pool ? `/${pool}` : "");
    const prior = existing(banks, bank, pool);
    const batch = BATCH_LIMIT[bank] ?? DEFAULT_BATCH;

    const kept: unknown[] = [];
    const rejected: { key: string; why: string }[] = [];
    // Large-item banks are asked in several small requests. Each one sees the
    // items the earlier ones produced, so batch two does not re-invent batch one.
    for (let done = 0; done < count; done += batch) {
      const want = Math.min(batch, count - done);
      let drafted: unknown[];
      try {
        drafted = await draft(bank, pool, want, [...prior, ...kept]);
      } catch (err) {
        console.log(`  ERR  ${label}: ${(err as Error).message}`);
        break;
      }
      const verdict = review(
        bank,
        drafted.map((raw) => toStored(bank, raw as Record<string, unknown>)),
        new Set([...prior, ...kept].map(keyOf(bank))),
      );
      kept.push(...verdict.kept);
      rejected.push(...verdict.rejected);
    }

    console.log(`  ${label.padEnd(24)} ${kept.length} kept, ${rejected.length} rejected (bank: ${prior.length} -> ${prior.length + kept.length})`);
    for (const r of rejected) console.log(`      reject: ${r.key} -- ${r.why}`);
    for (const k of kept) console.log(`      +  ${JSON.stringify(k).slice(0, 150)}`);

    if (!dry) prior.push(...kept);
  }
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  const count = Number(arg("count") ?? 10);
  const which = arg("bank");

  if (!which) {
    console.log(`usage: --bank <${ALL_BANKS.join("|")}|all> [--count N] [--dry-run]`);
    process.exit(1);
  }
  const banksToRun: AnyBankName[] = which === "all" ? [...ALL_BANKS] : ALL_BANKS.filter((b) => b === which);
  if (!banksToRun.length) {
    console.log(`unknown bank "${which}"`);
    process.exit(1);
  }

  console.log(`${MODEL}${dry ? " (dry run -- nothing will be written)" : ""}\n`);

  // Banks are grouped by the file they live in so each file is read once,
  // filled, and written once -- three separate runs over ela-banks.json would
  // each overwrite the last one's work.
  const byFile = new Map<string, AnyBankName[]>();
  for (const bank of banksToRun) {
    byFile.set(FILE_OF(bank), [...(byFile.get(FILE_OF(bank)) ?? []), bank]);
  }

  for (const [file, banks] of byFile) {
    const loaded = JSON.parse(readFileSync(file, "utf8")) as Banks;
    console.log(file);
    for (const bank of banks) await harvestBank(loaded, bank, count, dry);
    if (!dry) {
      writeFileSync(file, JSON.stringify(loaded, null, 2) + "\n");
      console.log(`  wrote ${file}`);
    }
    console.log("");
  }

  if (dry) {
    console.log("dry run -- no changes written");
    return;
  }
  const total = BANK_NAMES.reduce((n, b) => n + poolsOf(b).flat().length, 0);
  console.log(`Review the diff, then run: npm test`);
  console.log(`(ELA bank total before this run: ${total} items)`);
}

main();
