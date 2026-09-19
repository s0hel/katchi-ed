"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnswerInput } from "./answer-input";
import { QuestionView } from "./question-view";
import { useProgress } from "@/lib/progress";
import { gradeLabel, GRADES, SUBJECTS } from "@/lib/curriculum";
import { newSeed } from "@/lib/rng";
import {
  buildReport, pickNext, recordAnswer as recordDiagnosticAnswer, startDiagnostic,
  scoreToGradeLabel, type DiagnosticPick, type DiagnosticState, type DiagnosticReport,
} from "@/lib/diagnostic";
import type { ClientQuestion, Subject } from "@/lib/types";

type Stage = "setup" | "running" | "done";

const LENGTHS = [10, 20, 30];

/**
 * Only subjects that span grades. The diagnostic's whole output is a grade
 * estimate per strand, which a single-grade test-prep subject cannot produce:
 * every item would sit at the same point on the scale and the estimate would
 * report back whatever it started with.
 */
const DIAGNOSTIC_SUBJECTS = SUBJECTS.filter((s) => s.kind === "core");

export function DiagnosticRunner() {
  const { profile, ready, setGrade, recordDiagnostic } = useProgress();
  const [stage, setStage] = useState<Stage>("setup");
  const [subject, setSubject] = useState<Subject>("math");
  const [length, setLength] = useState(20);
  const [state, setState] = useState<DiagnosticState | null>(null);
  const [pick, setPick] = useState<DiagnosticPick | null>(null);
  const [question, setQuestion] = useState<ClientQuestion | null>(null);
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<DiagnosticReport | null>(null);

  // The learner's saved grade is the default until they pick a different one,
  // derived rather than copied into state by an effect.
  const [gradeChoice, setGradeChoice] = useState<number | null>(null);
  const startGrade = gradeChoice ?? (ready ? profile.grade : 4);
  const setStartGrade = setGradeChoice;

  const savedRef = useRef(false);

  const serve = useCallback(async (next: DiagnosticState) => {
    const chosen = pickNext(next);
    if (!chosen) {
      setPick(null);
      setQuestion(null);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId: chosen.skill.id, level: chosen.level, seed: newSeed() }),
      });
      if (!res.ok) throw new Error("failed");
      setPick(chosen);
      setQuestion((await res.json()) as ClientQuestion);
      setResponse("");
    } finally {
      setBusy(false);
    }
  }, []);

  const begin = useCallback(async () => {
    savedRef.current = false;
    setReport(null);
    const fresh = startDiagnostic(subject, startGrade, length);
    setState(fresh);
    setStage("running");
    setGrade(startGrade);
    await serve(fresh);
  }, [subject, startGrade, length, serve, setGrade]);

  const submit = useCallback(async () => {
    if (!state || !pick || !question || busy || !response.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillId: pick.skill.id,
          level: question.level,
          seed: question.seed,
          response,
        }),
      });
      if (!res.ok) throw new Error("failed");
      const graded = (await res.json()) as { correct: boolean };
      const next = recordDiagnosticAnswer(state, pick, graded.correct);
      setState(next);

      if (next.finished) {
        const built = buildReport(next);
        setReport(built);
        setStage("done");
      } else {
        await serve(next);
      }
    } finally {
      setBusy(false);
    }
  }, [state, pick, question, response, busy, serve]);

  // Persist the result once, after the report renders.
  useEffect(() => {
    if (stage !== "done" || !report || !state || savedRef.current) return;
    savedRef.current = true;
    recordDiagnostic({
      subject: state.subject,
      overall: report.overall,
      strands: report.strands.map((s) => ({
        strand: s.strand, score: s.score, asked: s.asked, correct: s.correct,
      })),
    });
  }, [stage, report, state, recordDiagnostic]);

  if (stage === "setup") {
    return (
      <div className="kx-card mx-auto max-w-xl p-6">
        <h2 className="text-lg font-bold">Set up your diagnostic</h2>
        <p className="mt-1 text-sm text-[var(--kx-muted)]">
          Questions adapt to your answers. There&apos;s no pass or fail — the goal is to find the
          right level for each strand.
        </p>

        <Field label="Subject">
          <div className="flex gap-2">
            {DIAGNOSTIC_SUBJECTS.map((s) => (
              <Choice key={s.id} active={subject === s.id} onClick={() => setSubject(s.id)}>
                {s.name}
              </Choice>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-[var(--kx-muted)]">
            Test prep isn&apos;t offered here: a diagnostic reports the grade level you are working
            at, and CogAT and the ISEE are each pitched at one grade. Use an assessment for those.
          </p>
        </Field>

        <Field label="Your current grade">
          <select
            className="kx-input"
            value={startGrade}
            onChange={(e) => setStartGrade(Number(e.target.value))}
          >
            {GRADES.map((g) => (
              <option key={g.grade} value={g.grade}>{g.label}</option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-[var(--kx-muted)]">
            Only a starting point — the diagnostic moves up or down from here.
          </p>
        </Field>

        <Field label="Length">
          <div className="flex gap-2">
            {LENGTHS.map((n) => (
              <Choice key={n} active={length === n} onClick={() => setLength(n)}>
                {n} questions
              </Choice>
            ))}
          </div>
        </Field>

        <button type="button" className="kx-btn-primary mt-6 w-full py-3" onClick={begin}>
          Start diagnostic
        </button>
      </div>
    );
  }

  if (stage === "running" && state) {
    const progress = Math.round((state.asked / state.targetQuestions) * 100);
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-4">
          <div className="mb-1.5 flex justify-between text-xs font-semibold text-[var(--kx-muted)]">
            <span>
              Question {Math.min(state.asked + 1, state.targetQuestions)} of {state.targetQuestions}
            </span>
            <span>{pick?.strand}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--kx-surface-2)]">
            <div
              className="h-full rounded-full bg-brand-500 transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <section className="kx-card p-5 sm:p-7">
          {question ? (
            <>
              <QuestionView question={question} />
              <div className="mt-6">
                <AnswerInput
                  format={question.format}
                  value={response}
                  onChange={setResponse}
                  onSubmit={submit}
                  disabled={busy}
                />
              </div>
              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  className="kx-btn-primary"
                  onClick={submit}
                  disabled={busy || !response.trim()}
                >
                  {busy ? "Checking…" : "Submit"}
                </button>
                <span className="text-xs text-[var(--kx-muted)]">
                  No feedback until the end — answer as best you can.
                </span>
              </div>
            </>
          ) : (
            <p className="py-10 text-center text-sm text-[var(--kx-muted)]">Loading…</p>
          )}
        </section>
      </div>
    );
  }

  if (stage === "done" && report && state) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="kx-card p-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--kx-muted)]">
            Overall level
          </p>
          <p className="mt-2 text-4xl font-black">{scoreToGradeLabel(report.overall)}</p>
          <p className="mt-1 text-sm text-[var(--kx-muted)]">
            Based on {state.asked} questions across {report.strands.length} strands
          </p>
        </div>

        <h2 className="mt-8 mb-3 text-sm font-bold uppercase tracking-wide text-[var(--kx-muted)]">
          By strand
        </h2>
        <ul className="kx-card divide-y divide-[var(--kx-border)] overflow-hidden">
          {report.strands.map((s) => (
            <li key={s.strand} className="flex items-center gap-4 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{s.strand}</span>
                <span className="block text-xs text-[var(--kx-muted)]">
                  {s.asked > 0 ? `${s.correct} of ${s.asked} correct` : "Not assessed"}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-bold">{s.label}</span>
                <span className="block text-xs text-[var(--kx-muted)] tabular-nums">
                  {Math.round(s.score)}
                </span>
              </span>
            </li>
          ))}
        </ul>

        {report.recommended.length > 0 && (
          <>
            <h2 className="mt-8 mb-3 text-sm font-bold uppercase tracking-wide text-[var(--kx-muted)]">
              Practice these next
            </h2>
            <ul className="kx-card divide-y divide-[var(--kx-border)] overflow-hidden">
              {report.recommended.map((skill) => (
                <li key={skill.id}>
                  <Link
                    href={`/practice/${skill.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--kx-surface-2)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{skill.name}</span>
                      <span className="block text-xs text-[var(--kx-muted)]">
                        {gradeLabel(skill.grade)} · {skill.strand}
                      </span>
                    </span>
                    <span aria-hidden className="text-brand-600">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="kx-btn-ghost" onClick={() => setStage("setup")}>
            Run another diagnostic
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-sm font-semibold">{label}</p>
      {children}
    </div>
  );
}

function Choice({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100"
          : "border-[var(--kx-border)] hover:bg-[var(--kx-surface-2)]"
      }`}
    >
      {children}
    </button>
  );
}
