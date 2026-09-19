# Katchi

Adaptive practice and assessments for K–8 math and language arts, plus Algebra 1.
Built with Next.js App Router and deployed on Vercel.

**Live:** https://katchi-ed.vercel.app

## What it does

**Practice.** Every skill generates questions on the fly from a seeded PRNG, so
there is no finite question bank to memorize. Questions ramp through four
difficulty tiers as the learner's score climbs.

**SmartScore.** A 0–100 mastery meter rather than a percentage. Gains shrink as
the score rises and penalties grow, so reaching 100 means answering consistently
at the hardest tier — not getting lucky once. Roughly 18–22 correct answers in a
row takes a skill from 0 to mastery.

**Diagnostic.** An adaptive session that estimates a working grade level for each
strand independently, on a 0–1000 scale where grade *g* sits at `(g + 1) × 100`.
Step sizes decay as evidence accumulates, and missing an easy item costs more
than missing a hard one.

**Assessments.** Fixed-form question sets spread across a grade's strands,
answered without feedback, then scored with a per-question review.

**Printable worksheets.** Any grade, or any set of skills within it, prints as
a paper worksheet with an optional answer key. The sheet is a pure function of
its URL, so the link you land on reprints that exact worksheet and changing the
seed gives you form B.

**Lesson videos.** Each skill links a Khan Academy lesson, embedded through
YouTube's privacy-enhanced player.

## Architecture

```
src/lib/rng.ts            seeded xorshift PRNG — all question generation is pure
src/lib/generators/       47 math + 15 ELA question generators
src/lib/curriculum.ts     the skill catalog (subject → grade → strand → skill)
src/lib/grading.ts        answer normalization and comparison
src/lib/smartscore.ts     the mastery meter
src/lib/diagnostic.ts     adaptive strand-level estimation
src/lib/assessment.ts     fixed-form blueprints
src/lib/worksheet.ts      printable worksheet specs, encoded in the URL
src/lib/progress.ts       learner progress (localStorage, via useSyncExternalStore)
src/app/api/              question / grade / assessment-grade endpoints
```

### Answers never reach the browser

A question is a pure function of `(skillId, level, seed)`. `/api/question`
generates one and strips the answer before responding; the client holds only the
seed. When an answer is submitted, `/api/grade` regenerates the identical
question server-side and grades against it. Nothing in the page source reveals
the answer, and no question state has to be stored anywhere.

### Progress storage

Progress lives in `localStorage` today, which keeps the app deployable with zero
backend configuration. It is read through `useSyncExternalStore`, so the server
render and hydration agree and cross-tab updates come for free. Everything goes
through the API in `src/lib/progress.ts` — swapping in a database means
implementing `read`/`commit` and the mutators, not rewriting pages.

## Worksheets, PDFs, and the answer key

`/worksheet` builds a sheet; `/worksheet/print` renders it. The PDF comes from
the browser's own print dialog ("Save as PDF"), driven by the `@media print`
block at the end of `globals.css`. That block *is* the PDF renderer, which is
the point: a second PDF engine would have to re-draw the inline SVG figures and
the question tables that the screen already renders correctly. Instead print
drops the app chrome, forces the light palette (dark mode would otherwise print
near-white text onto white paper), and keeps a question whole on one page.

The sheet's whole spec lives in the query string, so `/worksheet/print` first
canonicalizes the URL and redirects — minting a seed if there isn't one, and
clamping anything out of range. The address you end up on reprints that exact
worksheet; the builder links without a seed, so every click is a new one.

### The answer key does not weaken `/api/grade`

A worksheet prints answers and practice never does, so the two must not be able
to name the same question. Worksheet item seeds are derived into
`[2^31, 2^32)`; `newSeed()` and the `seed` field of every request schema in
`api-schema.ts` stop at `2^31`. The spaces are disjoint by construction, so no
amount of editing a worksheet URL will print the answer to a question the app
is currently grading someone on — and the practice endpoints reject a worksheet
seed outright. `src/lib/__tests__/worksheet.test.ts` asserts both halves.

## Lesson videos and licensing

Videos are Khan Academy's, embedded from YouTube via `youtube-nocookie.com`. We
never re-host video files, and every lesson panel carries channel attribution
and a link back to the original. Khan Academy's content is licensed CC BY-NC-SA.

`src/data/videos.json` is curated offline by `scripts/harvest-videos.ts`, which
searches YouTube, confirms each result is Khan Academy's via the oEmbed endpoint,
and writes only verified video IDs. Nothing is scraped at request time, so the
app never renders an embed for a dead video.

```bash
npx vite-node scripts/harvest-videos.ts            # fill in skills with no video
npx vite-node scripts/harvest-videos.ts --refresh  # re-harvest everything
```

> **Before launching commercially:** the CC BY-NC-SA licence on Khan Academy's
> content carries a NonCommercial term. Embedding the official YouTube player is
> ordinary linking rather than redistribution, but if this becomes a paid
> product, get that reviewed rather than assuming the embed settles it.

## Question variety and the ELA banks

Math questions are computed, not stored: each one is a pure function of
(generator, level, seed), so widening a range widens the question space and a
student cannot exhaust a skill.

ELA is different. Those generators pick from curated content — a seed chooses an
item, it does not invent one — so the banks in `src/data/ela-banks.json` are the
ceiling on ELA variety. `scripts/generate-ela-items.ts` raises that ceiling by
drafting new items with Claude offline:

```bash
export ANTHROPIC_API_KEY=...   # or: ant auth login
npx vite-node scripts/generate-ela-items.ts -- --bank passages --count 12
npx vite-node scripts/generate-ela-items.ts -- --bank all --count 8 --dry-run
```

Generation stays offline on purpose. Grading works by re-deriving a question
server-side from its seed, which is only possible because generation is
deterministic; calling a model per request would break that, put unreviewed text
in front of a child, and add latency to every question. Instead the model writes
into the bank ahead of time, a maintainer reads the diff, and the runtime is
unchanged.

Every drafted item passes `reviewDraft` in `src/lib/generators/bank-schema.ts`
before it lands — the same rules `npm test` enforces on what is already
committed. Items that fail are printed and dropped, never auto-repaired.

## Development

```bash
npm install
npm run dev        # Turbopack dev server
npm test           # generators, grading, SmartScore, diagnostic, worksheets, content banks
npm run lint
npm run typecheck
npm run build      # Turbopack production build
```

### Toolchain pins

`typescript` is held at 5.9.x and `eslint` at 9.x on purpose. TypeScript 7 builds
fine, but `eslint-config-next@16` bundles `typescript-eslint@8`, which refuses to
run against it; ESLint 10 breaks the bundled `eslint-plugin-react`. Revisit both
once those land support. Everything else is current.

## Deploying

```bash
vercel              # preview deployment
vercel deploy --prod # production
```

`vercel.ts` sets caching for the prerendered catalog pages and a CSP that allows
the YouTube embed and nothing else. Both are verifiable against a deployment:

```bash
curl -sI https://katchi-ed.vercel.app/learn/math/5 | grep -i cache-control
# cache-control: public, max-age=3600, stale-while-revalidate=86400
```

Per-deployment URLs (`katchi-<hash>-<scope>.vercel.app`) sit behind Vercel
Deployment Protection and redirect to SSO; use `vercel curl` to inspect those.
The production alias is public.

## Adding a skill

1. Write a generator in `src/lib/generators/math.ts` or `ela.ts` and register it
   in the exported map at the bottom of the file.
2. Add an entry to `MATH_BY_GRADE` / `ELA_BY_GRADE` in `src/lib/curriculum.ts`.
3. Run `npm test` — the suite generates every skill at every level across six
   seeds and checks the question is well-formed, deterministic, varied, that it
   accepts its own answer, and that it rejects a wrong one.
4. Optionally add a search hint in `scripts/harvest-videos.ts` and re-run it.
5. For an ELA skill, add its content bank to `src/data/ela-banks.json`, type it
   in `src/lib/generators/banks.ts`, and give it a schema and a brief in
   `bank-schema.ts` / `scripts/generate-ela-items.ts` so it can be extended.
