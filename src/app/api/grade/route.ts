import { NextResponse } from "next/server";
import { getSkill } from "@/lib/curriculum";
import { generateQuestion } from "@/lib/generators";
import { gradeAnswer } from "@/lib/grading";
import { gradeRequest } from "@/lib/api-schema";

/** Re-derive the question from its seed and grade the response against it. */
export async function POST(request: Request) {
  const parsed = gradeRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { skillId, level, seed, response } = parsed.data;
  const skill = getSkill(skillId);
  if (!skill) {
    return NextResponse.json({ error: "Unknown skill" }, { status: 404 });
  }

  const question = generateQuestion(skill, Math.min(level, skill.levels ?? 4), seed);
  const result = gradeAnswer(question, response);

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
