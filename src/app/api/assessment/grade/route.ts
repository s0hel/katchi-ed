import { NextResponse } from "next/server";
import { getSkill } from "@/lib/curriculum";
import { generateQuestion } from "@/lib/generators";
import { gradeAnswer } from "@/lib/grading";
import { assessmentGradeRequest } from "@/lib/api-schema";

/**
 * Grade a whole assessment at once. Assessments withhold feedback until the
 * end, so the client submits every response together and gets the full review
 * back in one response.
 */
export async function POST(request: Request) {
  const parsed = assessmentGradeRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const results = parsed.data.items.map((item) => {
    const skill = getSkill(item.skillId);
    if (!skill) {
      return { correct: false, expected: "", explanation: "", skillId: item.skillId, stem: "" };
    }
    const question = generateQuestion(skill, Math.min(item.level, skill.levels ?? 4), item.seed);
    const graded = gradeAnswer(question, item.response);
    return {
      ...graded,
      skillId: item.skillId,
      skillName: skill.name,
      strand: skill.strand,
      stem: question.stem,
      response: item.response,
    };
  });

  return NextResponse.json(
    { results, correct: results.filter((r) => r.correct).length, total: results.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
