import { RichText } from "./rich-text";
import type { WorksheetPlan } from "@/lib/worksheet";
import type { FilledItem } from "@/lib/worksheet-questions";
import { usesPictureIcons } from "@/lib/generators/pictures";
import { PICTURE_CREDIT } from "@/lib/generators/pictures";
import type { AnswerFormat } from "@/lib/types";

/**
 * The printed sheet.
 *
 * This is a Server Component and has to stay one: it receives full `Question`
 * objects, answers included, and only ever renders the answers when the sheet
 * asked for a key. Marking it "use client" would serialize every answer into
 * the RSC payload and hand the whole worksheet away.
 */

/** Named here for the sheet's own props; produced by `fillWorksheet`. */
export type SheetItem = FilledItem;

const CHOICE_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export function WorksheetSheet({ plan, items }: { plan: WorksheetPlan; items: SheetItem[] }) {
  const groups = groupBySkill(items);
  const named = plan.skills.length > 1;

  return (
    <article className="kx-sheet text-[var(--kx-text)]">
      <SheetHeader plan={plan} />

      <div className={plan.spec.columns === 2 ? "kx-sheet--2col mt-6" : "mt-6"}>
        {groups.map((group) => (
          <section key={group.key} className="mt-6 first:mt-0">
            {named && (
              <h2 className="kx-sheet-item mb-2.5 break-after-avoid border-b border-[var(--kx-border)] pb-1 text-[0.7rem] font-bold uppercase tracking-wider text-[var(--kx-muted)]">
                {group.skill.code} · {group.skill.name}
                {group.instructions && (
                  <span className="ml-2 font-semibold normal-case tracking-normal">
                    {group.instructions}
                  </span>
                )}
              </h2>
            )}
            <ol className="space-y-4">
              {group.items.map((item) => (
                <QuestionItem
                  key={item.number}
                  item={item}
                  workSpace={plan.spec.workSpace}
                  // A directive the whole group shares is printed once, above.
                  showInstructions={!group.instructions}
                />
              ))}
            </ol>
          </section>
        ))}
      </div>

      <SheetFooter plan={plan} pictures={plan.skills.some((s) => usesPictureIcons(s.generator))} />

      {plan.spec.answerKey && <AnswerKey plan={plan} items={items} />}
    </article>
  );
}

function SheetHeader({ plan }: { plan: WorksheetPlan }) {
  return (
    <header className="border-b-2 border-[var(--kx-text)] pb-3">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[var(--kx-muted)]">
            Katchi worksheet
          </p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight">{plan.title}</h1>
          <p className="mt-0.5 text-sm text-[var(--kx-muted)]">{plan.subtitle}</p>
        </div>

        <dl className="flex items-end gap-5 text-sm">
          <Field label="Name" width="w-44" />
          <Field label="Date" width="w-24" />
          <div>
            <dt className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--kx-muted)]">
              Score
            </dt>
            <dd className="mt-1 font-semibold tabular-nums">
              <span className="kx-rule w-10" aria-hidden />
              {` / ${plan.items.length}`}
            </dd>
          </div>
        </dl>
      </div>
    </header>
  );
}

function Field({ label, width }: { label: string; width: string }) {
  return (
    <div>
      <dt className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--kx-muted)]">
        {label}
      </dt>
      <dd className="mt-1">
        <span className={`kx-rule ${width}`} aria-hidden />
      </dd>
    </div>
  );
}

function QuestionItem({
  item,
  workSpace,
  showInstructions,
}: {
  item: SheetItem;
  workSpace: boolean;
  showInstructions: boolean;
}) {
  const { question } = item;
  return (
    <li className="kx-sheet-item flex gap-2.5">
      <span className="w-6 shrink-0 pt-px text-right text-sm font-bold tabular-nums">
        {item.number}.
      </span>
      <div className="min-w-0 flex-1">
        {showInstructions && question.instructions && (
          <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--kx-muted)]">
            {question.instructions}
          </p>
        )}

        <RichText text={question.stem} className="text-[0.95rem] leading-snug" />

        {question.figure && (
          <div
            className="kx-figure my-2 max-w-[15rem]"
            // Figures are SVG strings built by our own generators, never user input.
            dangerouslySetInnerHTML={{ __html: question.figure }}
          />
        )}

        {workSpace && question.format.kind !== "choice" && <div className="h-16" aria-hidden />}

        <AnswerSpace format={question.format} />
      </div>
    </li>
  );
}

/** Somewhere to write the answer, shaped like the format the question expects. */
function AnswerSpace({ format }: { format: AnswerFormat }) {
  if (format.kind === "choice") {
    // Picture options print as the pictures themselves, laid out wide enough
    // to tell apart with a pencil in hand; the letter beside each is what the
    // learner circles.
    if (format.figures) {
      return (
        <ul className="kx-choice mt-1.5 flex flex-wrap gap-x-4 gap-y-2">
          {format.figures.map((figure, i) => (
            <li key={format.choices[i]} className="flex items-center gap-1.5">
              <span className="text-[0.9rem] font-semibold">{format.choices[i]}.</span>
              <span
                className="kx-figure w-24"
                // Figures are SVG strings built by our own generators, never user input.
                dangerouslySetInnerHTML={{ __html: figure }}
              />
            </li>
          ))}
        </ul>
      );
    }
    return (
      <ul className="kx-choice mt-1.5 flex flex-wrap gap-x-5 gap-y-0.5 text-[0.9rem]">
        {format.choices.map((choice, i) => (
          <li key={choice} className="flex items-baseline gap-1.5">
            <span className="font-semibold">{CHOICE_LETTERS[i] ?? i + 1}.</span>
            <RichText text={choice} />
          </li>
        ))}
      </ul>
    );
  }

  if (format.kind === "pair") {
    return (
      <p className="mt-2 flex flex-wrap items-baseline gap-x-6 text-sm font-semibold">
        {format.labels.map((label) => (
          <span key={label} className="flex items-baseline gap-1.5">
            {label}
            <span className="kx-rule w-16" aria-hidden />
          </span>
        ))}
      </p>
    );
  }

  const width = format.kind === "text" ? "w-full max-w-[22rem]" : "w-28";
  return (
    <p className="mt-2 flex items-baseline gap-2 text-sm font-semibold">
      Answer
      <span className={`kx-rule ${width}`} aria-hidden />
    </p>
  );
}

function SheetFooter({ plan, pictures }: { plan: WorksheetPlan; pictures: boolean }) {
  return (
    <p className="mt-8 border-t border-[var(--kx-border)] pt-2 text-[0.65rem] text-[var(--kx-muted)]">
      katchi-ed · sheet {plan.code} — reprint this exact worksheet, or change the code for a new one.
      {/* CC BY 4.0 asks for attribution wherever the artwork appears, and a
          printed sheet travels further from the app than anything else does. */}
      {pictures && ` ${PICTURE_CREDIT.text}`}
    </p>
  );
}

function AnswerKey({ plan, items }: { plan: WorksheetPlan; items: SheetItem[] }) {
  return (
    <section className="kx-page-break kx-key mt-10 pt-4">
      <header className="border-b-2 border-[var(--kx-text)] pb-2">
        <h2 className="text-xl font-black tracking-tight">Answer key</h2>
        <p className="text-sm text-[var(--kx-muted)]">
          {plan.title} · sheet {plan.code}
        </p>
      </header>

      <ol className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm sm:grid-cols-3">
        {items.map((item) => (
          <li key={item.number} className="kx-sheet-item flex gap-2 border-b border-[var(--kx-border)] pb-1">
            <span className="w-6 shrink-0 text-right font-bold tabular-nums">{item.number}.</span>
            <span className="min-w-0 flex-1 font-semibold">
              {answerLabel(item)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Answers are stored the way a learner would type them, which is terser than
 * a key wants: a choice is circled on paper rather than typed, and a pair is
 * a bare "7,4". Both are spelled out here.
 */
function answerLabel(item: SheetItem): string {
  const { format, answer } = item.question;

  if (format.kind === "choice") {
    const index = format.choices.indexOf(answer);
    const letter = index >= 0 ? CHOICE_LETTERS[index] : undefined;
    if (!letter) return answer;
    // A picture item answers with a letter, so "C. C" is all the key could
    // say from the choices alone. The figure describes itself for a screen
    // reader, and that description is exactly what a parent marking the sheet
    // needs: "C. pencil".
    if (format.figures) {
      const described = /aria-label="([^"]*)"/.exec(format.figures[index] ?? "")?.[1];
      return described ? `${letter}. ${described}` : letter;
    }
    return `${letter}. ${answer}`;
  }

  if (format.kind === "pair") {
    const parts = answer.split(",");
    return format.labels.map((label, i) => `${label} ${(parts[i] ?? "").trim()}`).join("   ");
  }

  return answer;
}

interface SheetGroup {
  key: string;
  skill: SheetItem["skill"];
  items: SheetItem[];
  /** Set when every question in the group carries the same directive. */
  instructions?: string;
}

function groupBySkill(items: SheetItem[]): SheetGroup[] {
  const groups: SheetGroup[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.skill.id === item.skill.id) last.items.push(item);
    else groups.push({ key: `${item.skill.id}-${item.number}`, skill: item.skill, items: [item] });
  }

  // "Write your answer in simplest form." under every question is noise on
  // paper; hoist it to the heading when the whole group says the same thing.
  for (const group of groups) {
    const first = group.items[0].question.instructions;
    if (first && group.items.every((i) => i.question.instructions === first)) {
      group.instructions = first;
    }
  }
  return groups;
}
