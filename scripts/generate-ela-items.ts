/**
 * Curation script (run by a maintainer, not at runtime).
 *
 * Drafts new ELA bank items with Claude and merges the ones that survive
 * validation into src/data/ela-banks.json.
 *
 *   export ANTHROPIC_API_KEY=...            # or: ant auth login
 *   npx vite-node scripts/generate-ela-items.ts -- --bank passages --count 12
 *   npx vite-node scripts/generate-ela-items.ts -- --bank all --count 8 --dry-run
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
import { reviewDraft, poolsOf, POS_TAGS, FIGURES, SENTENCE_TYPES } from "../src/lib/generators/bank-schema";

const OUT = "src/data/ela-banks.json";
const MODEL = "claude-opus-5";

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

const WIRE = {
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
} as const satisfies Record<BankName, z.ZodTypeAny>;

/** What each bank is for, and the rules a draft has to respect. */
const BRIEF: Record<BankName, string> = {
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
function existing(banks: Banks, bank: BankName, pool: string): unknown[] {
  return bank === "wordPairs"
    ? (banks.wordPairs[pool as "synonyms" | "antonyms"] ?? [])
    : ((banks[bank] as unknown[]) ?? []);
}

async function draft(bank: BankName, pool: string, count: number, prior: unknown[]) {
  const client = new Anthropic();
  const wire = WIRE[bank];
  const brief =
    bank === "wordPairs" && pool === "antonyms"
      ? BRIEF.wordPairs.replace("a true SYNONYM of it", "a true ANTONYM of it")
      : BRIEF[bank];

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
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

  if (response.stop_reason === "refusal") {
    throw new Error(`model declined: ${response.stop_details?.explanation ?? "no explanation"}`);
  }
  return response.parsed_output?.items ?? [];
}

/** wordPairs is stored as [word, answer, distractors]; everything else as-is. */
function toStored(bank: BankName, item: Record<string, unknown>): unknown {
  return bank === "wordPairs" ? [item.word, item.answer, item.distractors] : item;
}

async function harvestBank(banks: Banks, bank: BankName, count: number, dry: boolean) {
  const pools = bank === "wordPairs" ? ["synonyms", "antonyms"] : [""];

  for (const pool of pools) {
    const label = bank + (pool ? `/${pool}` : "");
    const prior = existing(banks, bank, pool);
    let drafted: unknown[];
    try {
      drafted = await draft(bank, pool, count, prior);
    } catch (err) {
      console.log(`  ERR  ${label}: ${(err as Error).message}`);
      continue;
    }

    const { kept, rejected } = reviewDraft(
      bank,
      drafted.map((raw) => toStored(bank, raw as Record<string, unknown>)),
    );

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
    console.log(`usage: --bank <${BANK_NAMES.join("|")}|all> [--count N] [--dry-run]`);
    process.exit(1);
  }
  const banksToRun: BankName[] =
    which === "all" ? [...BANK_NAMES] : BANK_NAMES.filter((b) => b === which);
  if (!banksToRun.length) {
    console.log(`unknown bank "${which}"`);
    process.exit(1);
  }

  const banks = JSON.parse(readFileSync(OUT, "utf8")) as Banks;
  console.log(`${MODEL}${dry ? " (dry run -- nothing will be written)" : ""}\n`);

  for (const bank of banksToRun) {
    await harvestBank(banks, bank, count, dry);
  }

  if (dry) {
    console.log("\ndry run -- no changes written");
    return;
  }
  writeFileSync(OUT, JSON.stringify(banks, null, 2) + "\n");
  const total = BANK_NAMES.reduce((n, b) => n + poolsOf(b).flat().length, 0);
  console.log(`\nwrote ${OUT}. Review the diff, then run: npm test`);
  console.log(`(bank total before this run: ${total} items)`);
}

main();
