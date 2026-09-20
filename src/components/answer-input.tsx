"use client";

import { useEffect, useRef } from "react";
import type { AnswerFormat } from "@/lib/types";

/**
 * One input per answer format. All of them report a single string, which is
 * what the grading endpoint normalizes -- so "1,200", "1200" and " 1200 " are
 * the learner's business, not the component's.
 */
export function AnswerInput({
  format,
  value,
  onChange,
  onSubmit,
  disabled,
  autoFocus = true,
}: {
  format: AnswerFormat;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && !disabled) firstRef.current?.focus();
  }, [autoFocus, disabled, format]);

  if (format.kind === "choice") {
    // A picture item answers with a letter and shows a shape, so the letter is
    // a label on the button rather than its content.
    const figures = format.figures;
    return (
      <div role="radiogroup" aria-label="Answer choices" className="grid gap-2 sm:grid-cols-2">
        {format.choices.map((option, i) => {
          const selected = value === option;
          const figure = figures?.[i];
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(option)}
              onDoubleClick={() => !disabled && onSubmit()}
              className={`rounded-xl border px-4 py-3.5 text-left text-base font-medium transition
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500
                disabled:cursor-not-allowed disabled:opacity-60 ${
                  figure ? "flex items-center gap-3" : ""
                } ${
                  selected
                    ? "border-brand-500 bg-brand-50 text-brand-900 ring-2 ring-brand-500/25 dark:bg-brand-900/40 dark:text-brand-100"
                    : "border-[var(--kx-border)] bg-[var(--kx-surface)] hover:border-brand-300 hover:bg-[var(--kx-surface-2)]"
                }`}
            >
              <span className={figure ? "font-bold text-[var(--kx-muted)]" : undefined}>{option}</span>
              {figure && (
                <span
                  // A fixed width, not flex-1: an option that stretches with
                  // its button renders bigger than the prompt above it, and a
                  // question about size cannot be read across two scales. One
                  // width at every breakpoint, because a nonverbal figure sets
                  // its own width to one cell -- 8rem -- and a narrower box
                  // here would scale it down and put the two panels out of
                  // step again.
                  className="kx-figure w-32 shrink-0"
                  // Figures are SVG strings built by our own generators, never user input.
                  dangerouslySetInnerHTML={{ __html: figure }}
                />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  if (format.kind === "pair") {
    const parts = value.split(",");
    const setPart = (index: number, part: string) => {
      const next = [parts[0] ?? "", parts[1] ?? ""];
      next[index] = part;
      onChange(next.join(","));
    };
    return (
      <div className="flex flex-wrap gap-3">
        {format.labels.map((label, i) => (
          <label key={label} className="flex items-center gap-2 text-base font-semibold">
            <span className="text-[var(--kx-muted)]">{label}</span>
            <input
              ref={i === 0 ? firstRef : undefined}
              className="kx-input w-28"
              inputMode="numeric"
              value={parts[i] ?? ""}
              disabled={disabled}
              onChange={(e) => setPart(i, e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            />
          </label>
        ))}
      </div>
    );
  }

  const numericish = format.kind === "numeric" || format.kind === "fraction";
  return (
    <input
      ref={firstRef}
      className="kx-input max-w-md"
      value={value}
      disabled={disabled}
      inputMode={format.kind === "numeric" ? "decimal" : "text"}
      autoComplete="off"
      autoCapitalize={numericish ? "off" : "sentences"}
      spellCheck={!numericish}
      placeholder={
        format.kind === "fraction"
          ? "e.g. 3/4"
          : format.kind === "text"
            ? (format.placeholder ?? "Your answer")
            : "Your answer"
      }
      aria-label="Your answer"
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onSubmit()}
    />
  );
}
