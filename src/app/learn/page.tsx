import Link from "next/link";
import type { Metadata } from "next";
import { SUBJECTS, gradesFor, skillsFor } from "@/lib/curriculum";

export const metadata: Metadata = { title: "Learn" };

export default function LearnPage() {
  return (
    <div className="py-4">
      <h1 className="text-3xl font-black tracking-tight">Choose a subject and grade</h1>
      <p className="mt-2 text-[var(--kx-muted)]">
        Every grade lists its skills by strand. Pick any skill to start practicing.
      </p>

      <div className="mt-8 space-y-10">
        {SUBJECTS.map((subject) => (
          <section key={subject.id} id={subject.id} className="scroll-mt-20">
            <h2 className="text-xl font-bold">{subject.name}</h2>
            <p className="mt-1 text-sm text-[var(--kx-muted)]">{subject.blurb}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {gradesFor(subject.id).map((grade) => {
                const count = skillsFor(subject.id, grade.grade).length;
                return (
                  <Link
                    key={grade.grade}
                    href={`/learn/${subject.id}/${grade.grade}`}
                    className="kx-card flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:border-brand-400"
                  >
                    <span
                      aria-hidden
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-base font-black text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                    >
                      {grade.short}
                    </span>
                    <span>
                      <span className="block font-semibold">{grade.label}</span>
                      <span className="block text-xs text-[var(--kx-muted)]">{count} skills</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
