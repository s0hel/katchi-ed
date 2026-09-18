import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SKILLS, byStrand, gradeLabel, skillsFor, subjectName } from "@/lib/curriculum";
import { SkillRow } from "@/components/skill-row";
import { hasVideo } from "@/lib/videos";
import type { Subject } from "@/lib/types";

interface Props {
  params: Promise<{ subject: string; grade: string }>;
}

/** Pre-render every subject/grade pair -- the catalog is static. */
export function generateStaticParams() {
  const pairs = new Set(SKILLS.map((s) => `${s.subject}/${s.grade}`));
  return [...pairs].map((pair) => {
    const [subject, grade] = pair.split("/");
    return { subject, grade };
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subject, grade } = await params;
  return { title: `${gradeLabel(Number(grade))} ${subjectName(subject as Subject)}` };
}

export default async function GradePage({ params }: Props) {
  const { subject, grade } = await params;
  const gradeNum = Number(grade);
  if (!["math", "ela"].includes(subject) || Number.isNaN(gradeNum)) notFound();

  const skills = skillsFor(subject as Subject, gradeNum);
  if (!skills.length) notFound();

  const groups = byStrand(skills);
  const withVideo = skills.filter((s) => hasVideo(s.id)).length;

  return (
    <div className="py-4">
      <Link href="/learn" className="text-sm font-semibold text-brand-700 dark:text-brand-300">
        ← All grades
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {gradeLabel(gradeNum)} {subjectName(subject as Subject).toLowerCase()}
          </h1>
          <p className="mt-1 text-sm text-[var(--kx-muted)]">
            {skills.length} skills
            {withVideo > 0 && ` · ${withVideo} with a lesson video`}
          </p>
        </div>

        <Link href={`/assessment?subject=${subject}&grade=${gradeNum}`} className="kx-btn-ghost">
          Take the {gradeLabel(gradeNum).toLowerCase()} assessment
        </Link>
      </div>

      <div className="mt-8 space-y-8">
        {groups.map((group) => (
          <section key={group.strand}>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--kx-muted)]">
              {group.strand}
            </h2>
            <ul className="kx-card divide-y divide-[var(--kx-border)] overflow-hidden">
              {group.skills.map((skill) => (
                <SkillRow key={skill.id} skill={skill} hasVideo={hasVideo(skill.id)} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
