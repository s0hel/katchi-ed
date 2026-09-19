import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SKILLS, getSkill, gradeLabel, subjectNameLower } from "@/lib/curriculum";
import { PracticeSession } from "@/components/practice-session";
import { videosForSkill } from "@/lib/videos";
import { usesPictureIcons } from "@/lib/generators/pictures";
import { PictureCredit } from "@/components/picture-credit";

interface Props {
  params: Promise<{ skillId: string }>;
}

export function generateStaticParams() {
  return SKILLS.map((s) => ({ skillId: s.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { skillId } = await params;
  const skill = getSkill(skillId);
  return {
    title: skill ? `${skill.name} — practice` : "Practice",
    description: skill ? `Practice ${skill.name} (${gradeLabel(skill.grade)}).` : undefined,
  };
}

export default async function PracticePage({ params }: Props) {
  const { skillId } = await params;
  const skill = getSkill(skillId);
  if (!skill) notFound();

  return (
    <div className="py-4">
      <div className="mb-5">
        <Link
          href={`/learn/${skill.subject}/${skill.grade}`}
          className="text-sm font-semibold text-brand-700 dark:text-brand-300"
        >
          ← {gradeLabel(skill.grade)} {subjectNameLower(skill.subject)}
        </Link>
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
          <span className="text-[var(--kx-muted)]">{skill.code}</span> {skill.name}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--kx-muted)]">
          <span>{skill.strand}</span>
          <Link
            href={`/worksheet?subject=${skill.subject}&grade=${skill.grade}&skills=${skill.id}`}
            className="font-semibold text-brand-700 dark:text-brand-300"
          >
            Printable worksheet
          </Link>
        </div>
      </div>

      <PracticeSession skill={skill} videos={videosForSkill(skill)} />

      {usesPictureIcons(skill.generator) && <PictureCredit className="mt-6" />}
    </div>
  );
}
