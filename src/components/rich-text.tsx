import { Fragment, type ReactNode } from "react";

/**
 * Question stems use a deliberately tiny markup subset -- **bold**, _italic_,
 * and pipe tables -- so generators can emphasise values without us shipping a
 * markdown parser or ever setting raw HTML from question text.
 */

function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|_[^_]+_)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={`${keyPrefix}-b${i++}`} className="font-bold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(
        <em key={`${keyPrefix}-i${i++}`} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith("|");
}

function isDivider(line: string): boolean {
  return /^\|[\s|:-]+\|$/.test(line.trim());
}

function cells(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
}

export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isTableRow(line)) {
      const rows: string[][] = [];
      let header: string[] | null = null;
      while (i < lines.length && isTableRow(lines[i])) {
        if (isDivider(lines[i])) {
          header = rows.pop() ?? null;
        } else {
          rows.push(cells(lines[i]));
        }
        i++;
      }
      blocks.push(
        <table key={`t${i}`}>
          {header && (
            <thead>
              <tr>{header.map((c, x) => <th key={x}>{inline(c, `h${x}`)}</th>)}</tr>
            </thead>
          )}
          <tbody>
            {rows.map((row, y) => (
              <tr key={y}>{row.map((c, x) => <td key={x}>{inline(c, `c${y}-${x}`)}</td>)}</tr>
            ))}
          </tbody>
        </table>,
      );
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    blocks.push(
      <p key={`p${i}`} className="my-2 first:mt-0 last:mb-0">
        {inline(line, `p${i}`)}
      </p>,
    );
    i++;
  }

  return <div className={`kx-stem ${className}`}>{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
