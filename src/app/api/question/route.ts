import { NextResponse } from "next/server";
import { getSkill } from "@/lib/curriculum";
import { generateQuestion } from "@/lib/generators";
import { questionRequest } from "@/lib/api-schema";
import type { ClientQuestion } from "@/lib/types";

/**
 * Serve a question with the answer stripped out. The client gets only
 * (skillId, level, seed), which is enough for /api/grade to rebuild the exact
 * same question server-side -- so the answer never travels to the browser.
 */
export async function POST(request: Request) {
  const parsed = questionRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const skill = getSkill(parsed.data.skillId);
  if (!skill) {
    return NextResponse.json({ error: "Unknown skill" }, { status: 404 });
  }

  const level = Math.min(parsed.data.level, skill.levels ?? 4);
  const full = generateQuestion(skill, level, parsed.data.seed);
  const { answer, accept, explanation, ...safe } = full;
  void answer;
  void accept;
  void explanation;

  return NextResponse.json(safe satisfies ClientQuestion, {
    headers: { "Cache-Control": "no-store" },
  });
}
