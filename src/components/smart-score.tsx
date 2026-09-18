"use client";

import { BAND_CLASS, BAND_LABEL, MASTERY, PROFICIENT, scoreBand } from "@/lib/smartscore";

/**
 * The SmartScore meter. It shows the score, the band, and a marker at the
 * proficiency threshold so the next milestone is always visible.
 */
export function SmartScoreMeter({
  score,
  delta,
  size = "md",
  showLabel = true,
}: {
  score: number;
  delta?: number | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}) {
  const band = scoreBand(score);
  const styles = BAND_CLASS[band];
  const height = size === "lg" ? "h-3.5" : size === "sm" ? "h-1.5" : "h-2.5";

  return (
    <div>
      {showLabel && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--kx-muted)]">
            SmartScore
          </span>
          <span className="flex items-baseline gap-2">
            {delta != null && delta !== 0 && (
              <span
                className={`text-xs font-bold tabular-nums ${
                  delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {delta > 0 ? `+${delta}` : delta}
              </span>
            )}
            <span className={`font-bold tabular-nums ${size === "lg" ? "text-2xl" : "text-lg"} ${styles.text}`}>
              {score}
            </span>
            <span className="text-xs text-[var(--kx-muted)]">/ {MASTERY}</span>
          </span>
        </div>
      )}

      <div
        className={`relative w-full overflow-hidden rounded-full bg-[var(--kx-surface-2)] ${height}`}
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={MASTERY}
        aria-label={`SmartScore ${score} of ${MASTERY}, ${BAND_LABEL[band]}`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${styles.bar}`}
          style={{ width: `${score}%` }}
        />
        <div
          aria-hidden
          className="absolute inset-y-0 w-px bg-[var(--kx-border)]"
          style={{ left: `${PROFICIENT}%` }}
          title={`Proficient at ${PROFICIENT}`}
        />
      </div>

      {showLabel && (
        <div className="mt-1.5 flex justify-between text-xs text-[var(--kx-muted)]">
          <span className={`kx-chip ${styles.chip}`}>{BAND_LABEL[band]}</span>
          {score < MASTERY && (
            <span className="self-center tabular-nums">
              {score < PROFICIENT ? `${PROFICIENT - score} to proficient` : `${MASTERY - score} to mastery`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const band = scoreBand(score);
  if (band === "none") {
    return <span className="kx-chip bg-[var(--kx-surface-2)] text-[var(--kx-muted)]">—</span>;
  }
  return <span className={`kx-chip tabular-nums ${BAND_CLASS[band].chip}`}>{score}</span>;
}
