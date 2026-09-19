"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { byStrand, gradeLabel, gradesFor, skillsFor, SUBJECTS } from "@/lib/curriculum";
import {
  DEFAULT_QUESTIONS,
  MAX_QUESTIONS,
  unseededQuery,
  type WorksheetLevel,
  type WorksheetSpec,
} from "@/lib/worksheet";
import type { Subject } from "@/lib/types";

/**
 * Picks the shape of a worksheet and links to the printable version.
 *
 * The link deliberately carries no seed. `/worksheet/print` mints one and
 * redirects, so every click produces a fresh set of questions while the URL
 * you land on reprints that exact sheet.
 */

const COUNTS = [8, 10, 12, 15, 20, 25, 30, MAX_QUESTIONS];
const LEVELS: { value: WorksheetLevel; label: string; hint: string }[] = [
  { value: "mixed", label: "Mixed", hint: "Ramps through each skill's tiers" },
  { value: 1, label: "1", hint: "Easiest tier" },
  { value: 2, label: "2", hint: "" },
  { value: 3, label: "3", hint: "" },
  { value: 4, label: "4", hint: "Hardest tier" },
];

export function WorksheetBuilder({
  initialSubject,
  initialGrade,
  initialSkillIds,
}: {
  initialSubject: Subject;
  initialGrade: number;
  initialSkillIds: string[];
}) {
  const [subject, setSubject] = useState<Subject>(initialSubject);
  const [grade, setGrade] = useState(initialGrade);
  const [selected, setSelected] = useState<string[]>(initialSkillIds);
  const [count, setCount] = useState(DEFAULT_QUESTIONS);
  const [level, setLevel] = useState<WorksheetLevel>("mixed");
  const [columns, setColumns] = useState<1 | 2>(1);
  const [workSpace, setWorkSpace] = useState(false);
  const [answerKey, setAnswerKey] = useState(true);

  const skills = useMemo(() => skillsFor(subject, grade), [subject, grade]);
  const groups = useMemo(() => byStrand(skills), [skills]);
  const grades = useMemo(() => gradesFor(subject), [subject]);

  // Switching subject or grade invalidates the selection, so it is reset in
  // the handler rather than chased with an effect.
  const move = (nextSubject: Subject, nextGrade: number) => {
    const available = skillsFor(nextSubject, nextGrade);
    setSubject(nextSubject);
    setGrade(available.length ? nextGrade : (gradesFor(nextSubject)[0]?.grade ?? 0));
    setSelected([]);
  };

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const spec: Omit<WorksheetSpec, "seed"> = {
    subject,
    grade,
    skillIds: selected,
    count,
    level,
    columns,
    workSpace,
    answerKey,
  };
  const href = `/worksheet/print?${unseededQuery(spec)}`;

  const chosen = selected.length || skills.length;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-5">
        <section className="kx-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--kx-muted)]">
            Subject and grade
          </h2>

          <div className="mt-3 flex flex-wrap gap-2">
            {SUBJECTS.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={subject === s.id}
                onClick={() => move(s.id, grade)}
                className={subject === s.id ? "kx-btn-primary" : "kx-btn-ghost"}
              >
                {s.name}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {grades.map((g) => (
              <button
                key={g.grade}
                type="button"
                aria-pressed={grade === g.grade}
                aria-label={g.label}
                onClick={() => move(subject, g.grade)}
                className={`h-10 min-w-10 rounded-lg border px-3 text-sm font-bold transition ${
                  grade === g.grade
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-[var(--kx-border)] hover:bg-[var(--kx-surface-2)]"
                }`}
              >
                {g.short}
              </button>
            ))}
          </div>
        </section>

        <section className="kx-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--kx-muted)]">
              Skills
            </h2>
            <p className="text-xs text-[var(--kx-muted)]">
              {selected.length
                ? `${selected.length} selected`
                : `All ${skills.length} skills in ${gradeLabel(grade).toLowerCase()}`}
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelected([])}
                  className="ml-2 font-semibold text-brand-700 underline underline-offset-2 dark:text-brand-300"
                >
                  clear
                </button>
              )}
            </p>
          </div>

          <div className="mt-3 space-y-4">
            {groups.map((group) => (
              <div key={group.strand}>
                <p className="mb-1.5 text-xs font-bold text-[var(--kx-muted)]">{group.strand}</p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {group.skills.map((skill) => (
                    <label
                      key={skill.id}
                      className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--kx-surface-2)]"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-[var(--color-brand-600)]"
                        checked={selected.includes(skill.id)}
                        onChange={() => toggle(skill.id)}
                      />
                      <span>
                        <span className="font-semibold text-[var(--kx-muted)]">{skill.code}</span>{" "}
                        {skill.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
        <section className="kx-card space-y-4 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--kx-muted)]">
            Sheet options
          </h2>

          <label className="block text-sm font-semibold">
            Questions
            <select
              className="kx-input mt-1 text-base"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            >
              {COUNTS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <div>
            <p className="text-sm font-semibold">Difficulty</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {LEVELS.map((option) => (
                <button
                  key={String(option.value)}
                  type="button"
                  title={option.hint}
                  aria-pressed={level === option.value}
                  onClick={() => setLevel(option.value)}
                  className={`h-9 rounded-lg border px-3 text-sm font-semibold transition ${
                    level === option.value
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-[var(--kx-border)] hover:bg-[var(--kx-surface-2)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t border-[var(--kx-border)] pt-4">
            <Check
              checked={columns === 2}
              onChange={(v) => setColumns(v ? 2 : 1)}
              label="Two columns"
              hint="Fits more short questions per page"
            />
            <Check
              checked={workSpace}
              onChange={setWorkSpace}
              label="Room to show work"
              hint="Blank space under each question"
            />
            <Check
              checked={answerKey}
              onChange={setAnswerKey}
              label="Include answer key"
              hint="Printed on its own page at the end"
            />
          </div>
        </section>

        <section className="kx-card p-5">
          <p className="text-sm text-[var(--kx-muted)]">
            {count} questions drawn from {chosen} {chosen === 1 ? "skill" : "skills"}.
          </p>
          <Link href={href} className="kx-btn-primary mt-3 w-full">
            Build the worksheet →
          </Link>
          <p className="mt-2 text-xs text-[var(--kx-muted)]">
            Opens the printable sheet, where <strong>Print</strong> → <strong>Save as PDF</strong>{" "}
            gives you the file.
          </p>
        </section>
      </aside>
    </div>
  );
}

function Check({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-[var(--color-brand-600)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm">
        <span className="font-semibold">{label}</span>
        <span className="block text-xs text-[var(--kx-muted)]">{hint}</span>
      </span>
    </label>
  );
}
