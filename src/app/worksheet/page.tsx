import type { Metadata } from "next";
import { WorksheetBuilder } from "@/components/worksheet-builder";
import { gradesFor, isSubject, skillsFor } from "@/lib/curriculum";
import type { Subject } from "@/lib/types";

export const metadata: Metadata = {
  title: "Worksheets",
  description: "Build a printable worksheet for any grade or set of skills, with an answer key.",
};

interface Props {
  searchParams: Promise<{ subject?: string; grade?: string; skills?: string }>;
}

export default async function WorksheetPage({ searchParams }: Props) {
  const { subject, grade, skills } = await searchParams;

  const validSubject: Subject = subject && isSubject(subject) ? subject : "math";
  const parsedGrade = Number(grade);
  const validGrade =
    Number.isInteger(parsedGrade) && skillsFor(validSubject, parsedGrade).length
      ? parsedGrade
      : (gradesFor(validSubject)[0]?.grade ?? 0);

  const available = new Set(skillsFor(validSubject, validGrade).map((s) => s.id));
  const initialSkillIds = (skills ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((id) => available.has(id));

  return (
    <div className="py-4">
      <div className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-black tracking-tight">Printable worksheets</h1>
        <p className="mt-2 text-[var(--kx-muted)]">
          Pick a grade, or just the skills you want, and get a paper worksheet with an answer key.
          Questions are generated fresh every time, so the same selection never prints the same
          sheet twice — and the link you land on reprints that exact sheet whenever you need it.
        </p>
      </div>

      <WorksheetBuilder
        initialSubject={validSubject}
        initialGrade={validGrade}
        initialSkillIds={initialSkillIds}
      />
    </div>
  );
}
