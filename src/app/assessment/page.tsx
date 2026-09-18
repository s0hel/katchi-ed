import type { Metadata } from "next";
import { AssessmentRunner } from "@/components/assessment-runner";
import type { Subject } from "@/lib/types";

export const metadata: Metadata = {
  title: "Assessments",
  description: "Fixed-form assessments across a grade's strands, scored with a full review.",
};

export default async function AssessmentPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; grade?: string }>;
}) {
  const { subject, grade } = await searchParams;
  const validSubject: Subject = subject === "ela" ? "ela" : "math";
  const parsedGrade = Number(grade);
  const validGrade = Number.isInteger(parsedGrade) && parsedGrade >= 0 && parsedGrade <= 9
    ? parsedGrade
    : undefined;

  return (
    <div className="py-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black tracking-tight">Assessments</h1>
        <p className="mx-auto mt-2 max-w-xl text-[var(--kx-muted)]">
          A fixed set of questions spread across a grade&apos;s strands — answered without hints or
          feedback, then scored with a full review.
        </p>
      </div>
      <AssessmentRunner initialSubject={validSubject} initialGrade={validGrade} />
    </div>
  );
}
