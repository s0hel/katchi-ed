# Katchi

Adaptive practice and assessments for K–8 math and language arts, plus Algebra 1
— and entrance-test practice for the CogAT (first grade) and the ISEE (sixth
grade). Built with Next.js App Router and deployed on Vercel.

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
src/lib/generators/       75 generators: 47 math, 15 ELA, 9 CogAT, 4 ISEE
src/lib/generators/shapes.ts    figures for CogAT's nonverbal battery
src/lib/generators/counters.ts  the abacus and the trains
src/lib/generators/pictures.ts  picture items, drawn from vendored artwork
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

Questions are generated in `worksheet-questions.ts`, kept apart from the
planner because it imports the generators and they carry the answers. It also
does one thing the planner cannot: a skill backed by a content bank picks an
item rather than inventing one, so a sheet of eight sentence-completion
questions can land on the same sentence twice. A repeat is re-derived from a
further seed in the same worksheet seed space — deterministically, so the sheet
is still a pure function of its URL — and two questions count as the same one
when their prompts match, since reshuffled distractors do not make a new
question.

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

Not every lesson is Khan Academy's. Khan teaches topics, not entrance-test
formats, so the CogAT skills are curated by hand from elsewhere — currently
[Kiducator](https://www.youtube.com/@Kiducator), which covers picture
analogies, picture classification, number series and figure analogies. A skill
can carry a series rather than a single lesson (picture analogies has three
parts plus a practice set), and the panel lets you pick between them.

Because of that, `channel` is a property of each video rather than a constant,
and so is the credit line under the player: Khan Academy's states the CC
BY-NC-SA licence because that licence grants us something, while any other
channel gets the narrower truth — we embed their player and they keep every
right they had. `harvest-videos.ts` leaves hand-curated entries alone, even
under `--refresh`, since no search would find them again.

Otherwise the catalog is keyed by skill id, with one exception: a test-prep
skill that shares a generator with a math skill shows that skill's lesson,
because it is the same topic under a different name. A skill with no
counterpart and no curated lesson — paper folding, ISEE synonyms, quantitative
comparison — shows nothing and says why, rather than sending a parent to search
for a lesson that does not exist.

```bash
npx vite-node scripts/harvest-videos.ts            # fill in skills with no video
npx vite-node scripts/harvest-videos.ts --refresh  # re-harvest everything
```

> **Before launching commercially:** the CC BY-NC-SA licence on Khan Academy's
> content carries a NonCommercial term. Embedding the official YouTube player is
> ordinary linking rather than redistribution, but if this becomes a paid
> product, get that reviewed rather than assuming the embed settles it.

## Test prep: CogAT and the ISEE

Two subjects in the catalog are exams rather than courses, and they behave a
little differently: each is pitched at a single grade, because an exam is sat
at one point rather than taught across a band. `SUBJECTS` marks them
`kind: "test-prep"`, which is what the app keys off to word an assessment as a
"practice test", to skip them in the diagnostic (a diagnostic reports the grade
level you are working at, and a one-grade subject has nothing to report), and
to stop offering a lesson search for a format nobody teaches as a topic.

**CogAT, Level 7 — first grade.** Nine skills, three in each of the three
batteries the test reports, matching the item types the form actually uses:

| Battery | Skills |
| --- | --- |
| Verbal | Picture analogies, Picture classification, Sentence completion *(read aloud)* |
| Quantitative | Number analogies *(sets of objects)*, Number series *(abacus)*, Number puzzles *(trains)* |
| Nonverbal | Figure analogies, Figure classification, Paper folding |

Adding Level 5/6 (kindergarten) or Level 8 (second grade) is a matter of adding
a grade to `COGAT_BY_GRADE` and widening the banks; nothing in the machinery
assumes one grade.

**Almost nothing here is written down, because at Level 7 almost nothing is.**
A six-year-old sitting this test is not assumed to read: a proctor reads the
instructions and the child answers from pictures. Presenting an item as text
would quietly turn a reasoning question into a reading question, which is the
one confound the format exists to avoid. So:

- **The whole verbal battery answers with pictures** (`pictures.ts`), sentence
  completion included — the item CogAT calls "Can you find it?", where the
  sentence is read to the child and they point at a picture. The banks write a
  picture as an emoji and its word — `🧦 sock` — because that is what a
  reviewer can read in a diff, and `scripts/build-icons.ts` vendors real SVG
  for each one into `src/data/picture-icons.json`. The word stays, small, under
  the picture: at home there is no proctor, so it is what the parent reads
  aloud and what a screen reader announces.

  This constrains the writing, and the schema enforces it: every option has to
  be a thing a six-year-old can point at. A sentence whose answer is "greater"
  or "sick" cannot be asked this way, however good the sentence is.
- **The quantitative battery is counted, not read** (`counters.ts`, and the
  set builders in `pictures.ts`). A number analogy shows three pens becoming
  five pens, then asks what two basketballs become; number series is an abacus
  whose rods gain a bead at a time; number puzzles are two trains that have to
  carry the same load, with one car left empty. All three are arithmetic with
  no numerals on the page — the rule is about how many, and a child who has
  only just met the symbols should not have to read them to show they know it.
- **The nonverbal battery is drawn** (`shapes.ts`), out of four attributes —
  shape, shading, size, count — with each generator stating a rule over them.
  A figure analogy applies one attribute change to a second pair,
  classification holds one attribute constant while varying every other, paper
  folding mirrors punched holes about a crease. Because the rule is data, the
  answer and the distractors are derived from it rather than hand-keyed, and
  the wrong options are the specific mistakes the item invites: the rule
  applied twice, the rule applied to the wrong attribute, the paper left
  folded.

One deliberate departure: **fewer options at the bottom tiers**. Levels 1–2 of
a picture item offer three choices, levels 3–4 offer four. With nothing to
read, the number of pictures to hold in mind is most of the difficulty.

Picture artwork is [Twemoji](https://github.com/jdecked/twemoji), licensed
CC BY 4.0 — attribution required wherever it appears, which is why the credit
renders under the practice question and in the worksheet footer rather than on
a licences page nobody opens. Only the icons the banks actually use are
vendored, so the repo carries ~140 of them rather than all 3,700:

```bash
npx vite-node scripts/build-icons.ts           # after adding picture items
npx vite-node scripts/build-icons.ts -- --check # fail if the file is stale
```

> CogAT is an ability measure. Practice does not make a child brighter, and this
> is not built on the premise that it does. What it removes is the part of a low
> score that is only unfamiliarity — the first few figure matrices a child ever
> sees are spent working out what is being asked rather than answering it.

**ISEE, Middle Level — sixth grade.** A sixth grader applying for grades 7–8
sits the Middle Level, and the catalog covers its four scored sections: Verbal
Reasoning (synonyms and single-blank sentence completion — no analogies; those
are the SSAT's), Quantitative Reasoning, Reading Comprehension, and Mathematics
Achievement. The essay is sent to schools unscored, so there is nothing here to
grade against and no skill for it.

Mathematics Achievement is not reimplemented. It tests the arithmetic,
pre-algebra and geometry the math catalog already generates, so those skills are
catalog entries pointing at existing math generators — which is also why an ISEE
math skill can borrow the Khan Academy lesson belonging to the math skill it
shares a generator with (see `borrowed()` in `src/lib/videos.ts`). Only the
items that exist nowhere but an entrance exam get their own generators.

Quantitative comparison is the one worth reading. Each column is a function of
the unknown, and the keyed answer comes from evaluating both across every value
the given information allows: the verdict is "cannot be determined" exactly when
that sweep disagrees with itself. Nothing is hand-keyed, which matters because
"cannot be determined" is the option students learn to avoid — and an item that
keys it by a writer's judgement is how they learn to distrust it.

## Question variety and the content banks

Math questions are computed, not stored: each one is a pure function of
(generator, level, seed), so widening a range widens the question space and a
student cannot exhaust a skill.

Anything built on words is different. Those generators pick from curated content
— a seed chooses an item, it does not invent one — so the banks are the ceiling
on variety: `src/data/ela-banks.json`, and `cogat-banks.json` /
`isee-banks.json` for the two exams. `scripts/generate-items.ts` raises that
ceiling by drafting new items with Claude offline. Banks are addressed by name,
an exam bank qualified by its test:

```bash
export ANTHROPIC_API_KEY=...   # or: ant auth login
npx vite-node scripts/generate-items.ts -- --bank passages --count 12
npx vite-node scripts/generate-items.ts -- --bank isee.synonyms --count 20
npx vite-node scripts/generate-items.ts -- --bank all --count 8 --dry-run
```

Generation stays offline on purpose. Grading works by re-deriving a question
server-side from its seed, which is only possible because generation is
deterministic; calling a model per request would break that, put unreviewed text
in front of a child, and add latency to every question. Instead the model writes
into the bank ahead of time, a maintainer reads the diff, and the runtime is
unchanged.

Every drafted item passes `reviewDraft` in `src/lib/generators/bank-schema.ts`
(or `reviewExamDraft` in `exam-bank-schema.ts`, which reuses the same rules and
adds the exams' own — a picture item has to carry a picture, an ISEE passage has
to run long enough to put a word in context) before it lands. These are the same
rules `npm test` enforces on what is already committed. Items that fail are
printed and dropped, never auto-repaired.

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
5. For a skill that draws on written content, add its bank to the right JSON
   file, type it in `banks.ts` (ELA) or `exam-banks.ts` (CogAT, ISEE), and give
   it a schema and a brief in `bank-schema.ts` / `exam-bank-schema.ts` and
   `scripts/generate-items.ts` so it can be extended.
6. For a picture skill, run `npx vite-node scripts/build-icons.ts` so the new
   emoji get artwork. `npm test` fails if a bank names a picture nobody
   vendored.
