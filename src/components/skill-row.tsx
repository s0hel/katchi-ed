"use client";

import Link from "next/link";
import { useProgress } from "@/lib/progress";
import { ScoreBadge } from "./smart-score";
import type { Skill } from "@/lib/types";

/** One row in a grade's skill list, showing the learner's score for it. */
export function SkillRow({ skill, hasVideo }: { skill: Skill; hasVideo: boolean }) {
  const { skillState, ready } = useProgress();
  const score = ready ? skillState(skill.id).score : 0;

  return (
    <li>
      <Link
        href={`/practice/${skill.id}`}
        className="flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--kx-surface-2)]"
      >
        <span className="w-10 shrink-0 text-xs font-bold text-[var(--kx-muted)] tabular-nums">
          {skill.code}
        </span>
        <span className="min-w-0 flex-1 font-medium">{skill.name}</span>
        {hasVideo && (
          <span
            aria-label="Has a lesson video"
            title="Has a lesson video"
            className="shrink-0 text-xs text-rose-600 dark:text-rose-400"
          >
            ▶
          </span>
        )}
        <span className="w-12 shrink-0 text-right">
          <ScoreBadge score={score} />
        </span>
      </Link>
    </li>
  );
}
