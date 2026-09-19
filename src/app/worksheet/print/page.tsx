import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PrintButton } from "@/components/print-button";
import { WorksheetSheet } from "@/components/worksheet-sheet";
import { fillWorksheet } from "@/lib/worksheet-questions";
import {
  parseSpec,
  planWorksheet,
  rawQuery,
  specToQuery,
  unseededQuery,
  type WorksheetSpec,
} from "@/lib/worksheet";

/** Sheets are per-request and can carry an answer key; keep them out of indexes. */
export const metadata: Metadata = {
  title: "Worksheet",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function WorksheetPrintPage({ searchParams }: Props) {
  const params = await searchParams;
  // An unparseable link (a bookmark that lost its query, a grade we do not
  // teach) goes back to the builder rather than to a 404.
  const spec = parseSpec(params);
  if (!spec) redirect("/worksheet");

  // Canonicalize before rendering: a missing seed, a clamped count or a
  // dropped skill id all land the visitor on a URL that reprints this exact
  // sheet. `specToQuery(parseSpec(q)) === q` is the fixed point, so this
  // redirects at most once.
  const canonical = specToQuery(spec);
  if (rawQuery(params) !== canonical) redirect(`/worksheet/print?${canonical}`);

  const plan = planWorksheet(spec);
  const items = fillWorksheet(plan);

  return (
    <div className="py-4">
      <Toolbar spec={spec} />
      <WorksheetSheet plan={plan} items={items} />
    </div>
  );
}

function Toolbar({ spec }: { spec: WorksheetSpec }) {
  const withKey = `/worksheet/print?${specToQuery({ ...spec, answerKey: !spec.answerKey })}`;
  // No seed: the print route mints a new one, which is a different sheet.
  const reroll = `/worksheet/print?${unseededQuery(spec)}`;

  return (
    <div className="kx-screen-only mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--kx-border)] bg-[var(--kx-surface-2)] p-3">
      <PrintButton />
      <Link href={reroll} prefetch={false} className="kx-btn-ghost">
        New questions
      </Link>
      <Link href={withKey} prefetch={false} className="kx-btn-ghost">
        {spec.answerKey ? "Hide answer key" : "Add answer key"}
      </Link>
      <Link
        href={`/worksheet?${unseededQuery(spec)}`}
        className="kx-btn-ghost"
      >
        Change options
      </Link>
      <p className="ml-auto max-w-xs text-xs text-[var(--kx-muted)]">
        This bar is not printed. Bookmark the address to reprint this exact sheet.
      </p>
    </div>
  );
}
