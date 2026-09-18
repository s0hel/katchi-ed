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

## Development

```bash
npm install
npm run dev        # Turbopack dev server
npm test           # 35 tests: generators, grading, SmartScore, diagnostic
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
