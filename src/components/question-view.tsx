import { RichText } from "./rich-text";
import type { ClientQuestion } from "@/lib/types";

/** The prompt half of a question: instructions, stem, and any figure. */
export function QuestionView({ question }: { question: ClientQuestion }) {
  return (
    <div>
      {question.instructions && (
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
          {question.instructions}
        </p>
      )}

      <RichText text={question.stem} className="text-xl leading-relaxed sm:text-[1.35rem]" />

      {question.figure && (
        <div
          className="kx-figure mt-4 max-w-sm"
          // Figures are SVG strings built by our own generators, never user input.
          dangerouslySetInnerHTML={{ __html: question.figure }}
        />
      )}
    </div>
  );
}
