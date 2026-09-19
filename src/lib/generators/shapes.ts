/**
 * The figure kit behind CogAT's nonverbal battery.
 *
 * A nonverbal item has no words to reason from: the whole question is the
 * picture, and so is every answer choice. These builders emit inline SVG the
 * same way the math figures do -- same CSS variables, so they follow the
 * theme and print in black on white -- but with one extra rule that matters
 * more here than anywhere else: **every figure shares one viewBox**. Choices
 * are scaled to the width of their button, so two options drawn in different
 * boxes would render at different scales and a size question would answer
 * itself.
 */

export type ShapeName = "circle" | "square" | "triangle" | "diamond" | "hexagon" | "star";
export type Shading = "open" | "shaded" | "solid";

export interface Fig {
  shape: ShapeName;
  shading: Shading;
  /** 1 = small, 2 = large */
  size: 1 | 2;
  count: 1 | 2 | 3;
}

export const SHAPES: ShapeName[] = ["circle", "square", "triangle", "diamond", "hexagon", "star"];
export const SHADINGS: Shading[] = ["open", "shaded", "solid"];

/** The attributes a matrix or classification rule can turn on. */
export type Attribute = "shape" | "shading" | "size" | "count";

/** Identity of a figure, for dedupe and for "is this the same picture?" */
export function figKey(f: Fig): string {
  return `${f.count}-${f.size}-${f.shading}-${f.shape}`;
}

export function sameFig(a: Fig, b: Fig): boolean {
  return figKey(a) === figKey(b);
}

const SIZE_WORD = { 1: "small", 2: "large" } as const;
const COUNT_WORD = { 1: "one", 2: "two", 3: "three" } as const;

export function describe(f: Fig): string {
  const plural = f.count > 1 ? "s" : "";
  return `${COUNT_WORD[f.count]} ${SIZE_WORD[f.size]} ${f.shading} ${f.shape}${plural}`;
}

/**
 * Paint for one shading step. All three are the stroke colour at different
 * opacities rather than three separate colours, which is what keeps them
 * ordered -- open, half, full -- in the light theme, the dark theme, and in
 * print, where the stroke is plain black. The math figures' `--kx-fig-fill`
 * is deliberately not used: it is a pale wash, and against the dark theme's
 * background a washed shape is indistinguishable from an empty one.
 */
function paint(shading: Shading): string {
  if (shading === "solid") return 'fill="var(--kx-fig-stroke)"';
  if (shading === "shaded") return 'fill="var(--kx-fig-stroke)" fill-opacity="0.4"';
  return 'fill="none"';
}

/** Points of a regular polygon, first vertex pointing up. */
function polygon(cx: number, cy: number, r: number, sides: number): string {
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`);
  }
  return pts.join(" ");
}

function star(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = (Math.PI * i) / 5 - Math.PI / 2;
    pts.push(`${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`);
  }
  return pts.join(" ");
}

/** One shape, centred, with no wrapper. */
function shapeEl(shape: ShapeName, cx: number, cy: number, r: number, shading: Shading): string {
  const style = `${paint(shading)} stroke="var(--kx-fig-stroke)" stroke-width="2"`;
  switch (shape) {
    case "circle":
      return `<circle cx="${cx}" cy="${cy}" r="${r}" ${style}/>`;
    case "square": {
      const s = r * 1.72;
      return `<rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" rx="2" ${style}/>`;
    }
    case "triangle":
      return `<polygon points="${polygon(cx, cy + r * 0.12, r * 1.12, 3)}" ${style}/>`;
    case "diamond":
      return `<polygon points="${polygon(cx, cy, r * 1.15, 4)}" ${style}/>`;
    case "hexagon":
      return `<polygon points="${polygon(cx, cy, r, 6)}" ${style}/>`;
    case "star":
      return `<polygon points="${star(cx, cy, r * 1.15)}" ${style}/>`;
  }
}

/** The figure's shapes, laid out in a row centred on (cx, cy). */
export function figElements(f: Fig, cx: number, cy: number, unit: number): string {
  const r = unit * (f.size === 2 ? 1 : 0.6);
  const gap = unit * 2.3;
  const start = cx - ((f.count - 1) * gap) / 2;
  const out: string[] = [];
  for (let i = 0; i < f.count; i++) {
    out.push(shapeEl(f.shape, start + i * gap, cy, r, f.shading));
  }
  return out.join("");
}

/* ------------------------------------------------------------ standalone */

const BOX_W = 168;
const BOX_H = 76;

/** One figure on its own, sized so every figure in a question matches. */
export function figSvg(f: Fig): string {
  return `<svg viewBox="0 0 ${BOX_W} ${BOX_H}" role="img" aria-label="${describe(f)}">
    ${figElements(f, BOX_W / 2, BOX_H / 2, 21)}
  </svg>`;
}

/** Several figures side by side in their own boxes, e.g. "which one belongs?" */
export function figRowSvg(figs: Fig[]): string {
  const cellW = 84;
  const cellH = 76;
  const W = cellW * figs.length;
  const cells = figs
    .map((f, i) => {
      const x = i * cellW;
      return `<rect x="${x + 3}" y="3" width="${cellW - 6}" height="${cellH - 6}" rx="6"
        fill="none" stroke="var(--kx-fig-stroke)" stroke-width="1.5" opacity="0.5"/>
      ${figElements(f, x + cellW / 2, cellH / 2, 13)}`;
    })
    .join("");
  return `<svg viewBox="0 0 ${W} ${cellH}" role="img" aria-label="${figs.map(describe).join("; then ")}">
    ${cells}
  </svg>`;
}

/**
 * A figure analogy: `a` becomes `b`, so `c` becomes what?
 *
 * Drawn as the two pairs side by side with an arrow inside each, rather than
 * as a 2x2 matrix. The reasoning is identical -- a matrix is an analogy in a
 * grid -- but the arrow says out loud what the grid only implies, and a child
 * who cannot yet read has nothing else to tell them which way the rule runs.
 */
export function analogyRowSvg(a: Fig, b: Fig, c: Fig): string {
  const cell = 68;
  const arrow = 26;
  const gap = 20;
  const H = 74;
  const W = cell * 4 + arrow * 2 + gap;

  const box = (x: number, inner: string) =>
    `<rect x="${x + 2}" y="4" width="${cell - 4}" height="${H - 8}" rx="6"
      fill="none" stroke="var(--kx-fig-stroke)" stroke-width="1.5" opacity="0.5"/>${inner}`;
  const at = (f: Fig, x: number) => figElements(f, x + cell / 2, H / 2, 11);
  const arrowAt = (x: number) =>
    `<path d="M ${x + 5} ${H / 2} h ${arrow - 14} m -6 -5 l 6 5 l -6 5"
      fill="none" stroke="var(--kx-fig-stroke)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;

  // x positions: a, arrow, b, gap, c, arrow, "?"
  const xa = 0;
  const xb = cell + arrow;
  const xc = xb + cell + gap;
  const xq = xc + cell + arrow;

  return `<svg viewBox="0 0 ${W} ${H}" role="img"
    aria-label="${describe(a)} becomes ${describe(b)}. In the same way, ${describe(c)} becomes a missing figure.">
    ${box(xa, at(a, xa))}
    ${arrowAt(cell)}
    ${box(xb, at(b, xb))}
    ${box(xc, at(c, xc))}
    ${arrowAt(xc + cell)}
    ${box(xq, `<text x="${xq + cell / 2}" y="${H / 2 + 10}" text-anchor="middle"
      font-size="28" font-weight="700" fill="var(--kx-fig-stroke)">?</text>`)}
  </svg>`;
}

/* --------------------------------------------------------- paper folding */

/** A punched hole, on a 4x4 grid of possible positions inside the square. */
export interface Hole {
  col: number;
  row: number;
}

export type Fold = "vertical" | "horizontal";

const GRID = 4;

function holeMarks(holes: Hole[], x0: number, y0: number, w: number, h: number): string {
  const stepX = w / GRID;
  const stepY = h / GRID;
  return holes
    .map(
      (p) =>
        `<circle cx="${(x0 + stepX * (p.col + 0.5)).toFixed(1)}" cy="${(y0 + stepY * (p.row + 0.5)).toFixed(1)}"
          r="${(Math.min(stepX, stepY) * 0.26).toFixed(1)}" fill="var(--kx-fig-stroke)"/>`,
    )
    .join("");
}

/**
 * The prompt: a square already folded in half, with holes punched through it.
 * The crease is drawn as a solid edge and the folded-away half as a dashed
 * outline, which is how the paper actually looks on the page.
 */
export function foldedSvg(fold: Fold, holes: Hole[]): string {
  const S = 96;
  const pad = 10;
  const half = S / 2;
  const vertical = fold === "vertical";
  // The paper occupies the left half (vertical fold) or the top half. Its
  // cells stay the size they are on the full sheet -- folding hides half the
  // square, it does not shrink the grid -- so holes are placed against the
  // full square's spacing and simply never fall on the hidden half.
  const w = vertical ? half : S;
  const h = vertical ? S : half;

  const ghost = vertical
    ? `<rect x="${pad + half}" y="${pad}" width="${half}" height="${S}"
        fill="none" stroke="var(--kx-fig-stroke)" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.45"/>`
    : `<rect x="${pad}" y="${pad + half}" width="${S}" height="${half}"
        fill="none" stroke="var(--kx-fig-stroke)" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.45"/>`;

  return `<svg viewBox="0 0 ${S + pad * 2} ${S + pad * 2}" role="img"
    aria-label="A square sheet folded in half ${vertical ? "left over right" : "top over bottom"}, with ${holes.length} hole${holes.length === 1 ? "" : "s"} punched through it.">
    ${ghost}
    <rect x="${pad}" y="${pad}" width="${w}" height="${h}"
      fill="var(--kx-fig-fill)" stroke="var(--kx-fig-stroke)" stroke-width="2" rx="2"/>
    ${holeMarks(holes, pad, pad, S, S)}
  </svg>`;
}

/** An answer choice: the sheet opened flat, showing where the holes are. */
export function unfoldedSvg(holes: Hole[], fold: Fold): string {
  const S = 96;
  const pad = 10;
  const half = S / 2;
  const crease = fold === "vertical"
    ? `<line x1="${pad + half}" y1="${pad}" x2="${pad + half}" y2="${pad + S}"`
    : `<line x1="${pad}" y1="${pad + half}" x2="${pad + S}" y2="${pad + half}"`;

  return `<svg viewBox="0 0 ${S + pad * 2} ${S + pad * 2}" role="img"
    aria-label="An unfolded square with ${holes.length} hole${holes.length === 1 ? "" : "s"}.">
    <rect x="${pad}" y="${pad}" width="${S}" height="${S}"
      fill="var(--kx-fig-fill)" stroke="var(--kx-fig-stroke)" stroke-width="2" rx="2"/>
    ${crease} stroke="var(--kx-fig-stroke)" stroke-width="1" stroke-dasharray="3 4" opacity="0.5"/>
    ${holeMarks(holes, pad, pad, S, S)}
  </svg>`;
}

/**
 * Where a hole punched through folded paper ends up once it is opened.
 *
 * The punched half keeps its position; the half that was folded away gets the
 * mirror image. A vertical fold (left over right) mirrors columns about the
 * middle, a horizontal fold mirrors rows.
 */
export function unfoldHoles(holes: Hole[], fold: Fold): Hole[] {
  const out: Hole[] = [];
  for (const p of holes) {
    const mirror =
      fold === "vertical"
        ? { col: GRID - 1 - p.col, row: p.row }
        : { col: p.col, row: GRID - 1 - p.row };
    out.push(p, mirror);
  }
  return dedupeHoles(out);
}

export function dedupeHoles(holes: Hole[]): Hole[] {
  const seen = new Set<string>();
  const out: Hole[] = [];
  for (const p of holes) {
    const k = `${p.col},${p.row}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

export function holesKey(holes: Hole[]): string {
  return dedupeHoles(holes)
    .map((p) => `${p.col},${p.row}`)
    .sort()
    .join("|");
}

/**
 * Hole positions available on the punched half: the half a fold leaves
 * visible, in grid coordinates of the *folded* sheet.
 */
export function foldedSlots(fold: Fold): Hole[] {
  const out: Hole[] = [];
  for (let col = 0; col < (fold === "vertical" ? GRID / 2 : GRID); col++) {
    for (let row = 0; row < (fold === "vertical" ? GRID : GRID / 2); row++) {
      out.push({ col, row });
    }
  }
  return out;
}
