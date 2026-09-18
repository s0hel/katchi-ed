"use client";

import Link from "next/link";
import { useMemo } from "react";
import { getSkill, gradeLabel, subjectName } from "@/lib/curriculum";
import { useProgress, summarize } from "@/lib/progress";
import { scoreToGradeLabel } from "@/lib/diagnostic";
import { BAND_CLASS, BAND_LABEL, scoreBand } from "@/lib/smartscore";
import { SmartScoreMeter } from "./smart-score";

export function DashboardView() {
  const { profile, ready, streakDays, resetAll, exportProfile } = useProgress();
  const totals = useMemo(() => summarize(profile), [profile]);

  const practiced = useMemo(
    () =>
      Object.entries(profile.skills)
        .map(([id, state]) => ({ id, state, skill: getSkill(id) }))
        .filter((row) => row.skill)
        .sort((a, b) => (b.state.lastPracticed ?? 0) - (a.state.lastPracticed ?? 0)),
    [profile.skills],
  );

  const recentDays = useMemo(() => lastNDays(profile.activity, 14), [profile.activity]);
  const peak = Math.max(1, ...recentDays.map((d) => d.answered));

  if (!ready) {
    return <p className="py-16 text-center text-sm text-[var(--kx-muted)]">Loading your progress…</p>;
  }

  if (!practiced.length && !profile.diagnostics.length && !profile.assessments.length) {
    return (
      <div className="kx-card mx-auto max-w-lg p-8 text-center">
        <h2 className="text-lg font-bold">Nothing here yet</h2>
        <p className="mt-2 text-sm text-[var(--kx-muted)]">
          Practice a skill or take the diagnostic, and your progress will show up here.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/learn" className="kx-btn-primary">Browse skills</Link>
          <Link href="/diagnostic" className="kx-btn-ghost">Take the diagnostic</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Questions answered" value={totals.answered} />
        <StatCard label="Accuracy" value={`${totals.accuracy}%`} />
        <StatCard label="Skills mastered" value={totals.skillsMastered} sub={`${totals.skillsProficient} proficient`} />
        <StatCard label="Practice streak" value={streakDays ? `${streakDays} days` : "—"} sub={formatTime(totals.timeMs)} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--kx-muted)]">
          Last 14 days
        </h2>
        <div className="kx-card p-5">
          <div className="flex h-28 items-end gap-1.5">
            {recentDays.map((day) => (
              <div key={day.date} className="group flex flex-1 flex-col items-center gap-1.5">
                <div
                  className="w-full rounded-t bg-brand-500/85 transition group-hover:bg-brand-600"
                  style={{ height: `${Math.max(3, (day.answered / peak) * 100)}%` }}
                  title={`${day.date}: ${day.answered} answered, ${day.correct} correct`}
                />
                <span className="text-[0.6rem] text-[var(--kx-muted)]">{day.date.slice(8)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {practiced.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--kx-muted)]">
            Skills you&apos;ve practiced
          </h2>
          <ul className="kx-card divide-y divide-[var(--kx-border)] overflow-hidden">
            {practiced.map(({ id, state, skill }) => (
              <li key={id}>
                <Link
                  href={`/practice/${id}`}
                  className="block px-4 py-3.5 transition hover:bg-[var(--kx-surface-2)]"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{skill!.name}</span>
                      <span className="block text-xs text-[var(--kx-muted)]">
                        {gradeLabel(skill!.grade)} · {skill!.strand} · {state.correct}/{state.asked} correct
                      </span>
                    </span>
                    <span className={`kx-chip shrink-0 ${BAND_CLASS[scoreBand(state.score)].chip}`}>
                      {BAND_LABEL[scoreBand(state.score)]}
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <SmartScoreMeter score={state.score} size="sm" showLabel={false} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {profile.diagnostics.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--kx-muted)]">
            Diagnostics
          </h2>
          <ul className="kx-card divide-y divide-[var(--kx-border)] overflow-hidden">
            {[...profile.diagnostics].reverse().map((d) => (
              <li key={d.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{subjectName(d.subject)}</span>
                  <span className="text-sm font-bold">{scoreToGradeLabel(d.overall)}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--kx-muted)]">
                  {new Date(d.takenAt).toLocaleDateString()} ·{" "}
                  {d.strands.map((s) => `${s.strand}: ${scoreToGradeLabel(s.score)}`).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {profile.assessments.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--kx-muted)]">
            Assessments
          </h2>
          <ul className="kx-card divide-y divide-[var(--kx-border)] overflow-hidden">
            {[...profile.assessments].reverse().map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="block font-medium">
                    {subjectName(a.subject)} · {gradeLabel(a.grade)}
                  </span>
                  <span className="block text-xs text-[var(--kx-muted)]">
                    {new Date(a.takenAt).toLocaleDateString()}
                  </span>
                </span>
                <span className="text-sm font-bold tabular-nums">
                  {Math.round((a.correct / a.total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="kx-card p-5">
        <h2 className="text-sm font-bold">Your data</h2>
        <p className="mt-1 text-sm text-[var(--kx-muted)]">
          Progress is stored in this browser only — nothing is uploaded. Export it to move to
          another device.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="kx-btn-ghost"
            onClick={() => downloadJson(exportProfile())}
          >
            Export progress
          </button>
          <button
            type="button"
            className="kx-btn-ghost text-rose-700 dark:text-rose-300"
            onClick={() => {
              if (confirm("Erase all progress on this device? This can't be undone.")) resetAll();
            }}
          >
            Reset everything
          </button>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="kx-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--kx-muted)]">{label}</p>
      <p className="mt-1.5 text-3xl font-black tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--kx-muted)]">{sub}</p>}
    </div>
  );
}

function lastNDays(activity: { date: string; answered: number; correct: number }[], n: number) {
  const byDate = new Map(activity.map((a) => [a.date, a]));
  const out: { date: string; answered: number; correct: number }[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - (n - 1));
  for (let i = 0; i < n; i++) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    out.push(byDate.get(key) ?? { date: key, answered: 0, correct: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function formatTime(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min practiced`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m practiced`;
}

function downloadJson(json: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `katchi-progress-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
