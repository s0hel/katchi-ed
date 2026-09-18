"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnswerInput } from "./answer-input";
import { QuestionView } from "./question-view";
import { RichText } from "./rich-text";
import { useProgress } from "@/lib/progress";
import { buildAssessment, type AssessmentBlueprint } from "@/lib/assessment";
import { getSkill, gradeLabel, gradesFor, SUBJECTS } from "@/lib/curriculum";
import type { ClientQuestion, Subject } from "@/lib/types";

type Stage = "setup" | "loading" | "taking" | "scored";

interface GradedItem {
  correct: boolean;
  expected: string;
  explanation: string;
  skillId: string;
  skillName?: string;
  strand?: string;
  stem: string;
  response: string;
}

const LENGTHS = [5, 10, 15];

export function AssessmentRunner({
  initialSubject = "math",
  initialGrade,
}: {
  initialSubject?: Subject;
  initialGrade?: number;
}) {
  const { profile, ready, recordAssessment } = useProgress();
  const [stage, setStage] = useState<Stage>("setup");
  const [subject, setSubject] = useState<Subject>(initialSubject);
  const [gradeChoice, setGradeChoice] = useState<number | null>(initialGrade ?? null);
  const [count, setCount] = useState(10);

  const [blueprint, setBlueprint] = useState<AssessmentBlueprint | null>(null);
  const [questions, setQuestions] = useState<ClientQuestion[]>([]);
  const [responses, setResponses] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<GradedItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = useMemo(() => gradesFor(subject), [subject]);

  // The selected grade is derived: the learner's explicit pick, else their
  // saved grade, else the first grade this subject offers. Switching subjects
  // therefore can't strand the form on a grade that subject doesn't teach.
  const preferred = gradeChoice ?? (ready ? profile.grade : 4);
  const grade = available.some((g) => g.grade === preferred)
    ? preferred
    : (available[0]?.grade ?? 4);
  const setGrade = setGradeChoice;

  async function begin() {
    setStage("loading");
    setError(null);
    try {
      const plan = buildAssessment(subject, grade, count);
      const loaded = await Promise.all(
        plan.items.map(async (item) => {
          const res = await fetch("/api/question", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item),
          });
          if (!res.ok) throw new Error(`Question failed: ${res.status}`);
          return (await res.json()) as ClientQuestion;
        }),
      );
      setBlueprint(plan);
      setQuestions(loaded);
      setResponses(Array(loaded.length).fill(""));
      setIndex(0);
      setResults(null);
      setStage("taking");
    } catch {
      setError("Couldn't build the assessment. Please try again.");
      setStage("setup");
    }
  }

  const submit = useCallback(async () => {
    if (!blueprint || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/assessment/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: blueprint.items.map((item, i) => ({ ...item, response: responses[i] ?? "" })),
        }),
      });
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { results: GradedItem[] };
      setResults(data.results);
      setStage("scored");
    } catch {
      setError("Couldn't submit your answers. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [blueprint, responses, busy]);

  const savedRef = useRef<string | null>(null);
  useEffect(() => {
    if (stage !== "scored" || !results || !blueprint || savedRef.current === blueprint.id) return;
    savedRef.current = blueprint.id;

    const byStrand = new Map<string, { correct: number; total: number }>();
    for (const r of results) {
      const strand = r.strand ?? getSkill(r.skillId)?.strand ?? "Other";
      const bucket = byStrand.get(strand) ?? { correct: 0, total: 0 };
      bucket.total++;
      if (r.correct) bucket.correct++;
      byStrand.set(strand, bucket);
    }

    recordAssessment({
      subject: blueprint.subject,
      grade: blueprint.grade,
      correct: results.filter((r) => r.correct).length,
      total: results.length,
      byStrand: [...byStrand.entries()].map(([strand, v]) => ({ strand, ...v })),
    });
  }, [stage, results, blueprint, recordAssessment]);

  if (stage === "setup" || stage === "loading") {
    return (
      <div className="kx-card mx-auto max-w-xl p-6">
        <h2 className="text-lg font-bold">Build an assessment</h2>
        <p className="mt-1 text-sm text-[var(--kx-muted)]">
          A fixed set of questions across the grade&apos;s strands. No feedback until you submit.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
            {error}
          </p>
        )}

        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold">Subject</p>
          <div className="flex gap-2">
            {SUBJECTS.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={subject === s.id}
                onClick={() => setSubject(s.id)}
                className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${
                  subject === s.id
                    ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100"
                    : "border-[var(--kx-border)] hover:bg-[var(--kx-surface-2)]"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-sm font-semibold" htmlFor="grade">Grade</label>
          <select
            id="grade"
            className="kx-input"
            value={grade}
            onChange={(e) => setGrade(Number(e.target.value))}
          >
            {available.map((g) => (
              <option key={g.grade} value={g.grade}>{g.label}</option>
            ))}
          </select>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold">Questions</p>
          <div className="flex gap-2">
            {LENGTHS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={count === n}
                onClick={() => setCount(n)}
                className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${
                  count === n
                    ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100"
                    : "border-[var(--kx-border)] hover:bg-[var(--kx-surface-2)]"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="kx-btn-primary mt-6 w-full py-3"
          onClick={begin}
          disabled={stage === "loading"}
        >
          {stage === "loading" ? "Preparing…" : "Start assessment"}
        </button>
      </div>
    );
  }

  if (stage === "taking" && questions.length) {
    const question = questions[index];
    const answered = responses.filter((r) => r.trim()).length;
    const isLast = index === questions.length - 1;

    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-semibold">
            Question {index + 1} of {questions.length}
          </span>
          <span className="text-xs text-[var(--kx-muted)]">{answered} answered</span>
        </div>

        <div className="mb-4 flex gap-1" aria-hidden>
          {questions.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              title={`Go to question ${i + 1}`}
              className={`h-1.5 flex-1 rounded-full transition ${
                i === index
                  ? "bg-brand-600"
                  : responses[i]?.trim()
                    ? "bg-brand-300"
                    : "bg-[var(--kx-surface-2)]"
              }`}
            />
          ))}
        </div>

        <section className="kx-card p-5 sm:p-7">
          <QuestionView question={question} />
          <div className="mt-6">
            <AnswerInput
              key={index}
              format={question.format}
              value={responses[index] ?? ""}
              onChange={(v) => setResponses((prev) => prev.map((r, i) => (i === index ? v : r)))}
              onSubmit={() => (isLast ? void submit() : setIndex(index + 1))}
            />
          </div>
        </section>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="kx-btn-ghost"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
          >
            ← Previous
          </button>

          {isLast ? (
            <button type="button" className="kx-btn-primary" onClick={submit} disabled={busy}>
              {busy ? "Submitting…" : "Submit assessment"}
            </button>
          ) : (
            <button type="button" className="kx-btn-primary" onClick={() => setIndex((i) => i + 1)}>
              Next →
            </button>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (stage === "scored" && results && blueprint) {
    const correct = results.filter((r) => r.correct).length;
    const percent = Math.round((correct / results.length) * 100);

    const byStrand = new Map<string, { correct: number; total: number }>();
    for (const r of results) {
      const strand = r.strand ?? "Other";
      const bucket = byStrand.get(strand) ?? { correct: 0, total: 0 };
      bucket.total++;
      if (r.correct) bucket.correct++;
      byStrand.set(strand, bucket);
    }

    return (
      <div className="mx-auto max-w-3xl">
        <div className="kx-card p-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--kx-muted)]">
            {gradeLabel(blueprint.grade)} · {blueprint.title}
          </p>
          <p className="mt-2 text-5xl font-black tabular-nums">{percent}%</p>
          <p className="mt-1 text-sm text-[var(--kx-muted)]">
            {correct} of {results.length} correct
          </p>
        </div>

        <h2 className="mt-8 mb-3 text-sm font-bold uppercase tracking-wide text-[var(--kx-muted)]">
          By strand
        </h2>
        <ul className="kx-card divide-y divide-[var(--kx-border)] overflow-hidden">
          {[...byStrand.entries()].map(([strand, v]) => (
            <li key={strand} className="flex items-center gap-4 px-4 py-3">
              <span className="flex-1 font-medium">{strand}</span>
              <span className="text-sm font-bold tabular-nums">
                {v.correct}/{v.total}
              </span>
            </li>
          ))}
        </ul>

        <h2 className="mt-8 mb-3 text-sm font-bold uppercase tracking-wide text-[var(--kx-muted)]">
          Review
        </h2>
        <ol className="space-y-3">
          {results.map((r, i) => (
            <li
              key={i}
              className={`kx-card border-l-4 p-4 ${
                r.correct ? "border-l-emerald-500" : "border-l-rose-500"
              }`}
            >
              <div className="flex items-start gap-3">
                <span aria-hidden className={r.correct ? "text-emerald-600" : "text-rose-600"}>
                  {r.correct ? "✓" : "✕"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[var(--kx-muted)]">{r.skillName}</p>
                  <RichText text={r.stem} className="mt-1 text-sm" />
                  <p className="mt-2 text-sm">
                    <span className="text-[var(--kx-muted)]">Your answer: </span>
                    <span className="font-mono">{r.response || "(blank)"}</span>
                    {!r.correct && (
                      <>
                        {" · "}
                        <span className="text-[var(--kx-muted)]">Correct: </span>
                        <span className="font-mono font-semibold">{r.expected}</span>
                      </>
                    )}
                  </p>
                  {!r.correct && (
                    <div className="mt-2 rounded-lg bg-[var(--kx-surface-2)] p-3 text-sm">
                      <RichText text={r.explanation} />
                    </div>
                  )}
                  {!r.correct && (
                    <Link
                      href={`/practice/${r.skillId}`}
                      className="mt-2 inline-block text-sm font-semibold text-brand-700 dark:text-brand-300"
                    >
                      Practice this skill →
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="kx-btn-ghost" onClick={() => setStage("setup")}>
            New assessment
          </button>
          <Link href="/dashboard" className="kx-btn-primary">
            See my progress
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
