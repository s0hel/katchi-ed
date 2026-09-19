import { SKILLS, subjectKind, subjectName } from "./curriculum";
import { Rng } from "./rng";
import type { Skill, Subject } from "./types";

/**
 * A fixed-form assessment: a set number of questions drawn across a grade's
 * strands, answered without feedback, then scored and reviewed at the end.
 * Unlike practice (which adapts) an assessment is the same shape for everyone
 * who sits the same blueprint, which is what makes results comparable.
 */

export interface AssessmentItem {
  skillId: string;
  level: number;
  seed: number;
}

export interface AssessmentBlueprint {
  id: string;
  subject: Subject;
  grade: number;
  title: string;
  items: AssessmentItem[];
  createdAt: number;
}

export function buildAssessment(
  subject: Subject,
  grade: number,
  questionCount = 10,
  seed = Date.now(),
): AssessmentBlueprint {
  const rng = new Rng(seed);
  const pool = SKILLS.filter((s) => s.subject === subject && s.grade === grade);
  if (!pool.length) throw new Error(`No skills for ${subject} grade ${grade}`);

  // Spread across strands first, then fill from the remaining pool.
  const byStrand = new Map<string, Skill[]>();
  for (const s of pool) byStrand.set(s.strand, [...(byStrand.get(s.strand) ?? []), s]);

  const chosen: Skill[] = [];
  const strandLists = rng.shuffle([...byStrand.values()].map((list) => rng.shuffle([...list])));
  let round = 0;
  while (chosen.length < questionCount) {
    let addedThisRound = false;
    for (const list of strandLists) {
      if (chosen.length >= questionCount) break;
      const next = list[round];
      if (next) {
        chosen.push(next);
        addedThisRound = true;
      }
    }
    round++;
    if (!addedThisRound) {
      // Pool smaller than the requested count: reuse skills at higher levels.
      chosen.push(rng.pick(pool));
    }
  }

  const items: AssessmentItem[] = chosen.slice(0, questionCount).map((skill, i) => ({
    skillId: skill.id,
    // ramp difficulty through the form, so it discriminates across the range
    level: Math.min(skill.levels ?? 4, 1 + Math.floor((i / questionCount) * (skill.levels ?? 4))),
    seed: rng.int(1, 2 ** 30),
  }));

  return {
    id: `${subject}-${grade}-${seed.toString(36)}`,
    subject,
    grade,
    // A test-prep form is a rehearsal of a real exam, not a checkpoint on a
    // course, and calling it one would misdescribe what the score means.
    title: `${subjectName(subject)} ${subjectKind(subject) === "test-prep" ? "practice test" : "checkpoint"}`,
    items,
    createdAt: Date.now(),
  };
}

export interface AssessmentResult {
  correct: number;
  total: number;
  percent: number;
  byStrand: { strand: string; correct: number; total: number }[];
}

export function scoreAssessment(
  blueprint: AssessmentBlueprint,
  outcomes: boolean[],
): AssessmentResult {
  const byStrand = new Map<string, { correct: number; total: number }>();
  let correct = 0;

  blueprint.items.forEach((item, i) => {
    const skill = SKILLS.find((s) => s.id === item.skillId);
    const strand = skill?.strand ?? "Other";
    const bucket = byStrand.get(strand) ?? { correct: 0, total: 0 };
    bucket.total++;
    if (outcomes[i]) {
      bucket.correct++;
      correct++;
    }
    byStrand.set(strand, bucket);
  });

  const total = blueprint.items.length;
  return {
    correct,
    total,
    percent: total ? Math.round((correct / total) * 100) : 0,
    byStrand: [...byStrand.entries()].map(([strand, v]) => ({ strand, ...v })),
  };
}
