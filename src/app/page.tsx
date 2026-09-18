import Link from "next/link";
import { SKILLS, SUBJECTS } from "@/lib/curriculum";
import { videoCount } from "@/lib/videos";

const FEATURES = [
  {
    title: "Practice that adapts",
    body: "Every skill ramps through four difficulty tiers. Get them right and the questions get harder; miss one and it eases back. Questions are generated fresh each time, so nothing can be memorized.",
  },
  {
    title: "A SmartScore, not a percentage",
    body: "Your score climbs fast at first and slowly near the top, and a late mistake costs more than an early one. Reaching 100 means you can do it consistently, not that you got lucky once.",
  },
  {
    title: "A lesson when you're stuck",
    body: "Each skill links a Khan Academy lesson video, right beside the question, so you can learn the idea and come straight back to practice it.",
  },
  {
    title: "Diagnostics and assessments",
    body: "An adaptive diagnostic estimates a working grade level per strand. Fixed-form assessments give a comparable score across a whole grade.",
  },
];

export default function HomePage() {
  return (
    <div className="py-6">
      <section className="mx-auto max-w-3xl text-center">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
          K–8 · Algebra 1
        </p>
        <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">
          Practice until it clicks.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--kx-muted)]">
          Adaptive practice, real diagnostics, and a lesson video on every skill — across{" "}
          {SKILLS.length} math and language arts skills.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/learn" className="kx-btn-primary px-6 py-3 text-base">
            Start practicing
          </Link>
          <Link href="/diagnostic" className="kx-btn-ghost px-6 py-3 text-base">
            Take the diagnostic
          </Link>
        </div>
      </section>

      <section className="mt-14 grid gap-4 sm:grid-cols-2">
        {SUBJECTS.map((subject) => {
          const count = SKILLS.filter((s) => s.subject === subject.id).length;
          return (
            <Link
              key={subject.id}
              href={`/learn#${subject.id}`}
              className="kx-card group p-6 transition hover:-translate-y-0.5 hover:border-brand-400"
            >
              <h2 className="text-xl font-bold group-hover:text-brand-700 dark:group-hover:text-brand-300">
                {subject.name}
              </h2>
              <p className="mt-2 text-sm text-[var(--kx-muted)]">{subject.blurb}</p>
              <p className="mt-4 text-sm font-semibold text-brand-700 dark:text-brand-300">
                {count} skills →
              </p>
            </Link>
          );
        })}
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="kx-card p-6">
            <h3 className="text-base font-bold">{feature.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--kx-muted)]">{feature.body}</p>
          </div>
        ))}
      </section>

      <p className="mt-10 text-center text-xs text-[var(--kx-muted)]">
        {videoCount() > 0 && `${videoCount()} lesson videos · `}
        Lesson videos by{" "}
        <a
          className="underline underline-offset-2"
          href="https://www.youtube.com/c/khanacademy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Khan Academy
        </a>
        , embedded from YouTube under CC BY-NC-SA.
      </p>
    </div>
  );
}
