"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnswerInput } from "./answer-input";
import { QuestionView } from "./question-view";
import { RichText } from "./rich-text";
import { SmartScoreMeter } from "./smart-score";
import { VideoPanel } from "./video-panel";
import { recordAnswerFor, useHydrated, useSkillState } from "@/lib/progress";
import { newSeed } from "@/lib/rng";
import { feedbackLine, levelForScore, MASTERY } from "@/lib/smartscore";
import type { ClientQuestion, Skill } from "@/lib/types";
import type { LessonVideo } from "@/lib/videos";

type Phase = "loading" | "answering" | "checking" | "feedback" | "error";

interface Feedback {
  correct: boolean;
  expected: string;
  explanation: string;
  delta: number;
}

/**
 * What makes two served questions the same question. The prompt only: a
 * picture item asks the same sentence every time and varies in what it draws,
 * and reshuffled options do not make a new question.
 */
function asked(q: ClientQuestion): string {
  return `${q.stem}::${q.figure ?? ""}`;
}

export function PracticeSession({ skill, videos }: { skill: Skill; videos: LessonVideo[] }) {
  // "Watch the lesson" offers the first one; the panel handles the rest.
  const video = videos[0] ?? null;
  const state = useSkillState(skill.id);
  const ready = useHydrated();
  const [question, setQuestion] = useState<ClientQuestion | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [response, setResponse] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [videoOpen, setVideoOpen] = useState(false);

  // The score is held in a ref while a question is open, so the meter reflects
  // the score the question was chosen for rather than jumping mid-question.
  const scoreRef = useRef(state.score);
  const startedAt = useRef(0);
  const loadedFor = useRef<string | null>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  /** The question just served, so the next one is not the same one again. */
  const lastAsked = useRef("");

  const fetchQuestion = useCallback(
    async (score: number) => {
      const level = levelForScore(score, skill.levels ?? 4);
      const ask = async (): Promise<ClientQuestion> => {
        const res = await fetch("/api/question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skillId: skill.id, level, seed: newSeed() }),
        });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return (await res.json()) as ClientQuestion;
      };

      try {
        // Skills that draw from a content bank pick an item rather than
        // inventing one, so the same question can come up twice running. Two
        // in a row is the repeat a learner actually notices; asking again
        // costs one request and is bounded, because a small bank at a low
        // tier genuinely may not have another question to give.
        let next = await ask();
        for (let attempt = 0; attempt < 3 && asked(next) === lastAsked.current; attempt++) {
          next = await ask();
        }
        lastAsked.current = asked(next);
        setQuestion(next);
        startedAt.current = Date.now();
        setPhase("answering");
      } catch {
        setPhase("error");
      }
    },
    [skill.id, skill.levels],
  );

  // Request the first question once the stored score is known. The ref guard
  // keeps this to one fetch per skill even though the score is a dependency.
  useEffect(() => {
    if (!ready || loadedFor.current === skill.id) return;
    loadedFor.current = skill.id;
    scoreRef.current = state.score;
    void fetchQuestion(state.score);
  }, [ready, skill.id, state.score, fetchQuestion]);

  const submit = useCallback(async () => {
    if (!question || phase !== "answering" || !response.trim()) return;
    setPhase("checking");
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillId: skill.id,
          level: question.level,
          seed: question.seed,
          response,
        }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const graded = (await res.json()) as { correct: boolean; expected: string; explanation: string };

      const elapsed = Date.now() - startedAt.current;
      const before = scoreRef.current;
      const next = recordAnswerFor(skill.id, graded.correct, elapsed);
      scoreRef.current = next.score;

      setFeedback({ ...graded, delta: next.score - before });
      setSessionCount((n) => n + 1);
      setPhase("feedback");
      requestAnimationFrame(() => continueRef.current?.focus());
    } catch {
      setPhase("error");
    }
  }, [question, phase, response, skill.id]);

  // Clearing per-question UI lives here, in an event handler, not in an effect.
  const next = useCallback(() => {
    setPhase("loading");
    setFeedback(null);
    setResponse("");
    setShowHint(false);
    void fetchQuestion(scoreRef.current);
  }, [fetchQuestion]);

  // Enter advances from the feedback panel, matching the answering flow.
  useEffect(() => {
    if (phase !== "feedback") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, next]);

  // Offered after a wrong answer: open the lesson and bring it into view, so
  // the video is reachable at the moment the learner actually needs it.
  const openVideo = useCallback(() => {
    setVideoOpen(true);
    requestAnimationFrame(() => videoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, []);

  const mastered = state.score >= MASTERY;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="order-2 space-y-4 lg:order-1">
        <div ref={videoRef} className="scroll-mt-20">
          <VideoPanel
            skill={skill}
            videos={videos}
            open={videoOpen}
            onToggle={() => setVideoOpen((v) => !v)}
          />
        </div>

        <section className="kx-card p-5 sm:p-7" aria-live="polite">
          {phase === "error" ? (
            <div className="py-10 text-center">
              <p className="mb-4 font-semibold">Something went wrong loading this question.</p>
              <button type="button" className="kx-btn-primary" onClick={next}>
                Try again
              </button>
            </div>
          ) : !question ? (
            <QuestionSkeleton />
          ) : (
            <>
              <QuestionView question={question} />

              <div className="mt-6">
                <AnswerInput
                  format={question.format}
                  value={response}
                  onChange={setResponse}
                  onSubmit={submit}
                  disabled={phase !== "answering"}
                  autoFocus={phase === "answering"}
                />
              </div>

              {phase === "answering" && (
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="kx-btn-primary"
                    onClick={submit}
                    disabled={!response.trim()}
                  >
                    Check answer
                  </button>
                  {question.hint && !showHint && (
                    <button type="button" className="kx-btn-ghost" onClick={() => setShowHint(true)}>
                      Hint
                    </button>
                  )}
                  <span className="text-xs text-[var(--kx-muted)]">
                    Level {question.level} of {skill.levels ?? 4}
                  </span>
                </div>
              )}

              {phase === "checking" && (
                <p className="mt-5 text-sm text-[var(--kx-muted)]">Checking…</p>
              )}

              {showHint && question.hint && phase === "answering" && (
                <p className="mt-4 rounded-lg bg-[var(--kx-surface-2)] p-3 text-sm">
                  <span className="font-semibold">Hint: </span>
                  {question.hint}
                </p>
              )}

              {phase === "feedback" && feedback && (
                <FeedbackPanel
                  feedback={feedback}
                  message={feedbackLine(feedback.correct, state, feedback.delta)}
                  onNext={next}
                  onWatch={video && !videoOpen ? openVideo : null}
                  buttonRef={continueRef}
                />
              )}
            </>
          )}
        </section>

        {mastered && (
          <p className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
            🎉 You&apos;ve mastered this skill. Keep going to stay sharp, or{" "}
            <Link href={`/learn/${skill.subject}/${skill.grade}`} className="underline underline-offset-2">
              pick another skill
            </Link>
            .
          </p>
        )}
      </div>

      <aside className="order-1 space-y-4 lg:order-2">
        <div className="kx-card p-5">
          <SmartScoreMeter score={state.score} delta={feedback?.delta ?? null} size="lg" />
          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-[var(--kx-border)] pt-4 text-center">
            <Stat label="This session" value={sessionCount} />
            <Stat label="Answered" value={state.asked} />
            <Stat
              label="Accuracy"
              value={state.asked ? `${Math.round((state.correct / state.asked) * 100)}%` : "—"}
            />
          </dl>
        </div>
      </aside>
    </div>
  );
}

function FeedbackPanel({
  feedback,
  message,
  onNext,
  onWatch,
  buttonRef,
}: {
  feedback: Feedback;
  message: string;
  onNext: () => void;
  onWatch: (() => void) | null;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div
      className={`mt-6 rounded-xl border p-4 sm:p-5 ${
        feedback.correct
          ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50"
          : "border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/50"
      }`}
    >
      <p
        className={`flex items-center gap-2 text-base font-bold ${
          feedback.correct
            ? "text-emerald-800 dark:text-emerald-200"
            : "text-rose-800 dark:text-rose-200"
        }`}
      >
        <span aria-hidden>{feedback.correct ? "✓" : "✕"}</span>
        {message}
      </p>

      {!feedback.correct && (
        <p className="mt-2 text-sm">
          <span className="font-semibold">Correct answer: </span>
          <span className="font-mono">{feedback.expected}</span>
        </p>
      )}

      <div className="mt-3 border-t border-black/5 pt-3 text-sm dark:border-white/10">
        <p className="mb-1 font-semibold">How it works</p>
        <RichText text={feedback.explanation} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button ref={buttonRef} type="button" className="kx-btn-primary" onClick={onNext}>
          Next question →
        </button>
        {!feedback.correct && onWatch && (
          <button type="button" className="kx-btn-ghost" onClick={onWatch}>
            ▶ Watch the lesson
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--kx-muted)]">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function QuestionSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Loading question">
      <div className="h-4 w-32 rounded bg-[var(--kx-surface-2)]" />
      <div className="h-7 w-3/4 rounded bg-[var(--kx-surface-2)]" />
      <div className="h-12 w-64 rounded bg-[var(--kx-surface-2)]" />
    </div>
  );
}
