/**
 * Curation script (run by a maintainer, not at runtime).
 *
 * Finds one Khan Academy lesson video per skill and writes a static catalog to
 * src/data/videos.json. Doing this offline means the app never scrapes YouTube
 * at request time and never renders an embed for a video that doesn't exist.
 *
 *   npx vite-node scripts/harvest-videos.ts            # fill in missing skills
 *   npx vite-node scripts/harvest-videos.ts --refresh  # re-harvest everything
 *
 * Khan Academy content is CC BY-NC-SA. We embed the official YouTube player and
 * attribute the channel on every lesson; we never re-host the video files.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { SKILLS } from "../src/lib/curriculum";
import type { Skill } from "../src/lib/types";

const OUT = "src/data/videos.json";
const CHANNEL = "Khan Academy";

interface VideoEntry {
  videoId: string;
  title: string;
  channel: string;
  /** the query that found it, kept so a maintainer can tune bad matches */
  query: string;
  verifiedAt: string;
}

/** Search-term overrides where the skill name alone gives poor results. */
const QUERY_HINTS: Record<string, string> = {
  "count-objects": "counting objects numbers 1 to 10 kindergarten",
  "compare-numbers": "comparing whole numbers greater than less than",
  "add-within": "basic addition within 20",
  "sub-within": "basic subtraction within 20",
  "multi-digit-add": "multi digit addition with regrouping",
  "multi-digit-sub": "multi digit subtraction with regrouping borrowing",
  "multiplication-facts": "intro to multiplication basic facts",
  "division-facts": "intro to division basic facts",
  "multi-digit-multiply": "multiplying 2 digit numbers standard algorithm",
  "long-division": "long division with remainders",
  "place-value": "place value ones tens hundreds",
  rounding: "rounding whole numbers to nearest ten hundred",
  "gcf-lcm": "greatest common factor and least common multiple",
  "absolute-value": "absolute value of integers",
  "integer-ops": "adding and subtracting negative numbers integers",
  "order-of-operations": "order of operations PEMDAS",
  exponents: "intro to exponents powers",
  "scientific-notation": "scientific notation intro",
  "fraction-compare": "comparing fractions with unlike denominators",
  "fraction-add": "adding fractions with unlike denominators",
  "fraction-multiply": "multiplying and dividing fractions",
  "fraction-of-number": "fraction of a whole number word problem",
  "decimal-ops": "adding and subtracting decimals",
  "decimal-fraction-percent": "converting fractions decimals and percents",
  "percent-of-number": "finding a percent of a number",
  "percent-change": "percent increase and decrease discount",
  "ratio-proportion": "solving proportions cross multiply",
  "unit-rate": "unit rate intro",
  "unit-conversion": "converting units of measurement",
  "evaluate-expression": "evaluating algebraic expressions substitution",
  "one-step-equation": "solving one step equations",
  "two-step-equation": "solving two step equations",
  inequality: "solving one step inequalities",
  "slope-from-points": "finding slope from two points",
  "slope-intercept": "slope intercept form y equals mx plus b",
  "system-of-equations": "solving systems of equations elimination",
  "factor-quadratic": "factoring quadratic expressions",
  sequences: "arithmetic and geometric sequences patterns",
  "function-table": "function tables input output rule",
  "area-perimeter": "area and perimeter of rectangles",
  volume: "volume of rectangular prisms",
  pythagorean: "pythagorean theorem intro",
  angles: "complementary and supplementary angles",
  "coordinate-plane": "coordinate plane quadrants points",
  "mean-median-mode": "mean median mode and range",
  probability: "basic probability intro",
  "word-problem-rate": "rate distance time word problems",
  "synonyms-antonyms": "synonyms and antonyms",
  "parts-of-speech": "parts of speech nouns verbs adjectives",
  homophones: "commonly confused words its it's there their",
  "subject-verb-agreement": "subject verb agreement grammar",
  punctuation: "commas semicolons and colons punctuation",
  capitalization: "capitalization rules grammar",
  "sentence-type": "sentence fragments and run on sentences",
  "verb-tense": "verb tenses grammar",
  "prefix-suffix": "prefixes and suffixes word parts",
  "context-clues": "using context clues to determine word meaning",
  "main-idea": "finding the main idea of a passage reading",
  "figurative-language": "figurative language simile metaphor personification",
  analogies: "word analogies vocabulary",
  plurals: "plural nouns irregular plurals",
  "pronoun-antecedent": "pronoun antecedent agreement",
};

function queryFor(skill: Skill): string {
  const hint = QUERY_HINTS[skill.generator] ?? skill.name;
  return `khan academy ${hint}`;
}

interface SearchHit {
  videoId: string;
  owner: string;
  title: string;
}

function collectHits(node: unknown, out: SearchHit[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectHits(child, out);
    return;
  }
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  const renderer = obj["videoRenderer"] as Record<string, unknown> | undefined;
  if (renderer && typeof renderer["videoId"] === "string") {
    const title = readRun(renderer["title"]);
    const owner = readRun(renderer["ownerText"]);
    if (title) out.push({ videoId: renderer["videoId"] as string, owner: owner ?? "", title });
  }
  for (const child of Object.values(obj)) collectHits(child, out);
}

function readRun(node: unknown): string | null {
  const runs = (node as { runs?: { text?: string }[] } | undefined)?.runs;
  return runs?.[0]?.text ?? null;
}

/**
 * YouTube throttles bursts of searches, so every request retries with
 * exponential backoff. Without this the run dies partway through and most
 * skills end up with no video.
 */
async function fetchWithRetry(url: string, attempts = 4): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await sleep(2000 * 2 ** (attempt - 1) + Math.random() * 1000);
    try {
      const res = await fetch(url, {
        headers: {
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
        },
      });
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("request failed");
}

async function search(query: string): Promise<SearchHit[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const res = await fetchWithRetry(url);
  const html = await res.text();
  const match = html.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/);
  if (!match) return [];
  const hits: SearchHit[] = [];
  collectHits(JSON.parse(match[1]), hits);
  return hits;
}

/** Confirm the video exists, is embeddable, and really is Khan Academy's. */
async function verify(videoId: string): Promise<{ title: string; channel: string } | null> {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
  let res: Response;
  try {
    res = await fetchWithRetry(url, 3);
  } catch {
    return null;
  }
  const data = (await res.json()) as { title?: string; author_name?: string };
  if (!data.title || data.author_name !== CHANNEL) return null;
  return { title: data.title, channel: data.author_name };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const refresh = process.argv.includes("--refresh");
  const catalog: Record<string, VideoEntry> =
    !refresh && existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};

  // Skills sharing a generator+params can share a video; harvest once per query.
  const byQuery = new Map<string, Skill[]>();
  for (const skill of SKILLS) {
    const q = queryFor(skill);
    byQuery.set(q, [...(byQuery.get(q) ?? []), skill]);
  }

  let found = 0;
  let failed = 0;
  const queries = [...byQuery.entries()].filter(([, skills]) => refresh || skills.some((s) => !catalog[s.id]));
  console.log(`${queries.length} queries to run for ${SKILLS.length} skills\n`);

  for (const [query, skills] of queries) {
    try {
      const hits = (await search(query)).filter((h) => h.owner === CHANNEL);
      let entry: VideoEntry | null = null;
      for (const hit of hits.slice(0, 4)) {
        const ok = await verify(hit.videoId);
        if (ok) {
          entry = { videoId: hit.videoId, title: ok.title, channel: ok.channel, query, verifiedAt: new Date().toISOString().slice(0, 10) };
          break;
        }
        await sleep(400);
      }
      if (entry) {
        for (const s of skills) catalog[s.id] = entry;
        found++;
        console.log(`  ok   ${skills[0].generator.padEnd(26)} ${entry.title.slice(0, 58)}`);
      } else {
        failed++;
        console.log(`  MISS ${skills[0].generator.padEnd(26)} (${query})`);
      }
    } catch (err) {
      failed++;
      console.log(`  ERR  ${skills[0].generator.padEnd(26)} ${(err as Error).message}`);
    }
    await sleep(2500 + Math.random() * 1500);
  }

  const sorted = Object.fromEntries(Object.entries(catalog).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(OUT, JSON.stringify(sorted, null, 2) + "\n");
  const covered = SKILLS.filter((s) => sorted[s.id]).length;
  console.log(`\nwrote ${OUT}: ${covered}/${SKILLS.length} skills covered (${found} queries ok, ${failed} failed)`);
}

main();
