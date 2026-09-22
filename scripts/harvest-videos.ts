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
  /** share of query keywords present in the title, 0..1 */
  relevance?: number;
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
  "coordinate-plane": "coordinate plane quadrants negative numbers",
  "mean-median-mode": "mean median mode and range",
  probability: "basic probability intro",
  "word-problem-rate": "rate distance time word problems",
  "synonyms-antonyms": "shades of meaning synonyms word choice vocabulary",
  "parts-of-speech": "parts of speech nouns verbs adjectives",
  homophones: "commonly confused words its it's there their",
  "subject-verb-agreement": "subject verb agreement grammar",
  punctuation: "commas semicolons and colons punctuation",
  capitalization: "capitalization proper nouns beginning of a sentence",
  "sentence-type": "sentence fragments and run on sentences",
  "verb-tense": "verb tenses grammar",
  "prefix-suffix": "prefixes and suffixes word parts",
  "context-clues": "using context clues to determine word meaning",
  "main-idea": "finding the main idea of a passage reading",
  "figurative-language": "figurative language simile metaphor personification",
  analogies: "relationships between words analogy vocabulary",
  plurals: "plural nouns irregular plurals",
  "pronoun-antecedent": "pronoun antecedent agreement",
};

/**
 * Topics with no good lesson on the channel. Khan Academy teaches vocabulary
 * through context and word relationships rather than synonym/antonym or
 * analogy drills, so searches return confidently-wrong matches. These skills
 * fall back to the in-app "Search Khan Academy" link instead.
 */
const NO_GOOD_MATCH = new Set(["synonyms-antonyms", "analogies"]);

/**
 * Entrance-exam formats. Khan Academy teaches topics, not test formats, so a
 * search for "figure analogies" or "quantitative comparison" returns something
 * confidently unrelated. These are curated by hand or left empty; the app
 * says so rather than offering a lesson about something else.
 */
const isExamFormat = (generator: string) =>
  ["cogat-", "ngat-", "isee-"].some((prefix) => generator.startsWith(prefix));

/**
 * Per-skill overrides, for the cases where two skills share a generator but
 * need different lessons -- grade 5 stays in the first quadrant while grade 6
 * introduces negative coordinates, so they should not share a video.
 * Checked before the generator-level hints.
 */
const SKILL_HINTS: Record<string, string> = {
  "math-5-points-on-a-coordinate-grid": "plotting points on the coordinate plane first quadrant",
};

function queryFor(skill: Skill): string {
  const hint = SKILL_HINTS[skill.id] ?? QUERY_HINTS[skill.generator] ?? skill.name;
  return `khan academy ${hint}`;
}

/** Words too common to signal that a video is actually about the topic. */
const STOPWORDS = new Set([
  "khan", "academy", "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with",
  "intro", "introduction", "basic", "basics", "how", "what", "is", "are", "using", "use",
  "math", "maths", "grade", "video", "lesson", "example", "examples", "problem", "problems",
]);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

/**
 * Share of the query's meaningful words that appear in the video title.
 *
 * Used to RANK candidates, not to reject them. As a cutoff it was far too
 * blunt: "counting objects" scores 0.25 against "Counting dogs, mice, and
 * cookies" and "prefixes and suffixes" scores 0.00 against "Latin and Greek
 * roots and affixes" -- both excellent matches. Topics whose vocabulary simply
 * differs from Khan Academy's titles get a QUERY_HINTS entry instead.
 */
function relevance(query: string, title: string): number {
  const wanted = tokens(query);
  if (!wanted.size) return 0;
  const have = tokens(title);
  let hits = 0;
  for (const word of wanted) {
    // count a stem match too, so "fractions" matches "fraction"
    if (have.has(word) || [...have].some((h) => h.startsWith(word) || word.startsWith(h))) hits++;
  }
  return hits / wanted.size;
}

const MIN_RELEVANCE = 0;

/**
 * Khan Academy states the grade in most titles ("... | 5th grade | Khan
 * Academy"), which is a far stronger signal than keyword overlap. A grade-5
 * first-quadrant skill and a grade-6 quadrants skill search alike but must not
 * share a video, so titles that declare a grade are matched against the
 * skill's own grade.
 */
function declaredGrade(title: string): number | null {
  const t = title.toLowerCase();
  const nth = t.match(/\b(\d{1,2})(?:st|nd|rd|th)\s+grade\b/);
  if (nth) {
    const g = Number(nth[1]);
    if (g >= 1 && g <= 12) return g;
  }
  if (/\bkindergarten\b|\bearly math\b/.test(t)) return 0;
  if (/\balgebra\s*(i\b|1\b)|\bhigh school\b/.test(t)) return 9;
  if (/\bpre-?algebra\b/.test(t)) return 7;
  return null;
}

/** Keyword relevance, adjusted by how well the title's stated grade matches. */
function scoreFor(query: string, title: string, grade: number): number {
  const base = relevance(query, title);
  const declared = declaredGrade(title);
  if (declared === null) return base;
  return base + (declared === grade ? 0.5 : -0.12 * Math.abs(declared - grade));
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
  const existing: Record<string, VideoEntry | VideoEntry[]> = existsSync(OUT)
    ? JSON.parse(readFileSync(OUT, "utf8"))
    : {};

  // A refresh re-harvests this channel from scratch, but entries curated by
  // hand from somewhere else are not ours to re-derive -- there is no search
  // that would find them again. They survive both modes.
  const curated = Object.fromEntries(
    Object.entries(existing).filter(([, entry]) =>
      (Array.isArray(entry) ? entry : [entry]).some((v) => v.channel !== CHANNEL),
    ),
  );
  const catalog: Record<string, VideoEntry | VideoEntry[]> = refresh ? { ...curated } : existing;
  if (refresh && Object.keys(curated).length) {
    console.log(`keeping ${Object.keys(curated).length} hand-curated entr${Object.keys(curated).length === 1 ? "y" : "ies"}\n`);
  }

  const todo = SKILLS.filter(
    (s) => !NO_GOOD_MATCH.has(s.generator) && !isExamFormat(s.generator) && !catalog[s.id],
  );
  console.log(`${todo.length} skills to harvest (of ${SKILLS.length})\n`);

  // One search per distinct query, but the pick is per skill: two skills can
  // share a query and still land on different grade-appropriate videos.
  const searchCache = new Map<string, SearchHit[]>();
  const verifyCache = new Map<string, { title: string; channel: string } | null>();
  let found = 0;
  let failed = 0;

  for (const skill of todo) {
    const query = queryFor(skill);
    try {
      let hits = searchCache.get(query);
      if (!hits) {
        hits = (await search(query)).filter((h) => h.owner === CHANNEL);
        searchCache.set(query, hits);
        await sleep(2500 + Math.random() * 1500);
      }

      const ranked = hits
        .map((h) => ({ ...h, score: scoreFor(query, h.title, skill.grade) }))
        .filter((h) => h.score >= MIN_RELEVANCE)
        .sort((a, b) => b.score - a.score);

      let entry: VideoEntry | null = null;
      for (const hit of ranked.slice(0, 4)) {
        let ok = verifyCache.get(hit.videoId);
        if (ok === undefined) {
          ok = await verify(hit.videoId);
          verifyCache.set(hit.videoId, ok);
          await sleep(400);
        }
        if (ok) {
          entry = {
            videoId: hit.videoId,
            title: ok.title,
            channel: ok.channel,
            query,
            relevance: Number(hit.score.toFixed(2)),
            verifiedAt: new Date().toISOString().slice(0, 10),
          };
          break;
        }
      }

      if (entry) {
        catalog[skill.id] = entry;
        found++;
        console.log(`  ok   ${skill.id.padEnd(44)} [${entry.relevance}] ${entry.title.slice(0, 44)}`);
      } else {
        failed++;
        console.log(`  MISS ${skill.id.padEnd(44)} (${query})`);
      }
    } catch (err) {
      failed++;
      console.log(`  ERR  ${skill.id.padEnd(44)} ${(err as Error).message}`);
    }
  }

  const sorted = Object.fromEntries(Object.entries(catalog).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(OUT, JSON.stringify(sorted, null, 2) + "\n");
  const covered = SKILLS.filter((s) => sorted[s.id]).length;
  console.log(`\nwrote ${OUT}: ${covered}/${SKILLS.length} skills covered (${found} ok, ${failed} failed)`);
}

main();
