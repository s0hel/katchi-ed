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
 *
 * Figures are built as geometry -- points, not SVG transform attributes --
 * and every turn, flip and offset is applied to those points before anything
 * is emitted. That is what makes `figLook` possible: two figures can be
 * compared by what they actually draw rather than by what they claim to be.
 * A rule that turns a circle a quarter turn changes the figure's description
 * and nothing a child can see, and an analogy built on one is unanswerable.
 * Comparing the drawing catches that; comparing the attributes does not.
 */

export type ShapeName =
  | "circle" | "oval" | "square" | "triangle" | "diamond" | "hexagon" | "star" | "arrow" | "ell";
export type Shading = "open" | "shaded" | "solid";

/**
 * How the middle shape of a three differs from the two either side of it.
 *
 * Only the middle one, and only in a figure of three: "the odd one in the
 * middle" is a pattern a child can name, where an odd one anywhere is a
 * spot-the-difference.
 */
export interface OddOne {
  shape?: ShapeName;
  /** Quarter turns clockwise, on the middle shape alone. */
  turn?: 1 | 2 | 3;
  smaller?: boolean;
}

/** A smaller shape carried by a figure, either within it or sitting on it. */
export interface Inner {
  shape: ShapeName;
  count: 1 | 2;
  at: "inside" | "above";
}

export interface Fig {
  shape: ShapeName;
  shading: Shading;
  /** 1 = small, 2 = large */
  size: 1 | 2;
  count: 1 | 2 | 3;
  /** Quarter turns clockwise from upright. */
  turn?: 0 | 1 | 2 | 3;
  /** Mirrored left to right, after the turn. */
  flip?: boolean;
  /** A smaller shape inside the figure, or sitting above it. */
  inner?: Inner | null;
  /** The far half of the shape takes the opposite shading. */
  split?: boolean;
  /** An empty copy of the shape, offset behind it. */
  ghost?: boolean;
  /** Drawn as a solid body -- a second face, joined at the corners. */
  extruded?: boolean;
  /** Two shapes of unequal size, in this order. Overrides `size` and `count`. */
  pair?: "big-small" | "small-big";
  /** How the middle of three differs from the two beside it. */
  odd?: OddOne | null;
}

export const SHAPES: ShapeName[] = [
  "circle", "oval", "square", "triangle", "diamond", "hexagon", "star", "arrow", "ell",
];

/** Shapes with no corners. */
export const ROUND: ShapeName[] = ["circle", "oval"];
export const SHADINGS: Shading[] = ["open", "shaded", "solid"];

/** The attributes a classification rule can turn on. */
export type Attribute = "shape" | "shading" | "size" | "count";

/** Identity of a figure, for dedupe and for "is this the same picture?" */
export function figKey(f: Fig): string {
  return [
    f.count, f.size, f.shading, f.shape, f.turn ?? 0, f.flip ? "m" : "-",
    f.split ? "s" : "-", f.ghost ? "g" : "-", f.extruded ? "3" : "-", f.pair ?? "-",
    f.inner ? `${f.inner.count}${f.inner.shape}@${f.inner.at}` : "-",
    f.odd ? `odd${f.odd.shape ?? ""}${f.odd.turn ?? ""}${f.odd.smaller ? "-" : ""}` : "-",
  ].join("|");
}

export function sameFig(a: Fig, b: Fig): boolean {
  return figKey(a) === figKey(b);
}

const SIZE_WORD = { 1: "small", 2: "large" } as const;
const COUNT_WORD = { 1: "one", 2: "two", 3: "three" } as const;
const TURN_WORD = { 1: "on its side", 2: "upside down", 3: "on its other side" } as const;

export const SHAPE_WORDS: Record<ShapeName, string> = {
  circle: "circle", oval: "oval", square: "square", triangle: "triangle", diamond: "diamond",
  hexagon: "hexagon", star: "star", arrow: "arrow", ell: "L-shape",
};

/**
 * A figure in words.
 *
 * This is the aria-label, the explanation after a wrong answer, and the
 * printed answer key, so it has to name everything the picture shows: an
 * explanation reading "the shape turns: a large open arrow becomes a large
 * open arrow" teaches nothing.
 */
/** "a triangle", but "an oval" and "an arrow". */
export const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");

export function describe(f: Fig): string {
  const parts: string[] = [];
  if (f.pair) {
    const [first, second] = f.pair === "big-small" ? ["large", "small"] : ["small", "large"];
    parts.push(`a ${first} and a ${second} ${f.shading} ${SHAPE_WORDS[f.shape]}, the ${first} one first`);
  } else {
    const plural = f.count > 1 ? "s" : "";
    parts.push(`${COUNT_WORD[f.count]} ${SIZE_WORD[f.size]} ${f.shading} ${SHAPE_WORDS[f.shape]}${plural}`);
  }
  if (f.turn) parts.push(TURN_WORD[f.turn]);
  if (f.flip) parts.push("mirrored");
  if (f.split) parts.push("with its far half filled the other way");
  if (f.ghost) parts.push("with an empty copy behind it");
  if (f.extruded) parts.push("drawn as a solid block");
  if (f.inner) {
    const word = SHAPE_WORDS[f.inner.shape];
    const what = f.inner.count === 1 ? `${article(word)} smaller ${word}` : `two smaller ${word}s`;
    parts.push(f.inner.at === "inside" ? `with ${what} inside` : `with ${what} above it`);
  }
  if (f.odd) {
    const how: string[] = [];
    if (f.odd.shape) how.push(`${article(SHAPE_WORDS[f.odd.shape])} ${SHAPE_WORDS[f.odd.shape]}`);
    if (f.odd.smaller) how.push("smaller");
    if (f.odd.turn) how.push(TURN_WORD[f.odd.turn]);
    parts.push(`with the middle one ${how.join(" and ")}`);
  }
  return parts.join(", ");
}

/* ----------------------------------------------------------------- shapes */

interface Pt { x: number; y: number }

type Geom =
  | { kind: "poly"; pts: Pt[] }
  | { kind: "circle"; c: Pt; r: number }
  | { kind: "line"; a: Pt; b: Pt };

/** One drawn primitive: an outline and how it is filled. */
interface Mark { geom: Geom; shading: Shading }

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
function polygonPts(c: Pt, r: number, sides: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    pts.push({ x: c.x + r * Math.cos(angle), y: c.y + r * Math.sin(angle) });
  }
  return pts;
}

function starPts(c: Pt, r: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = (Math.PI * i) / 5 - Math.PI / 2;
    pts.push({ x: c.x + radius * Math.cos(angle), y: c.y + radius * Math.sin(angle) });
  }
  return pts;
}

/**
 * Outlines with no symmetry at all, so that a turn or a flip shows.
 *
 * Every regular polygon is its own mirror image and most of them survive a
 * quarter turn unchanged, which leaves a rotation rule with nothing to show
 * for itself. These two always show it.
 */
const ARROW_PTS = [
  [-1, -0.34], [0.14, -0.34], [0.14, -0.78], [1, 0], [0.14, 0.78], [0.14, 0.34], [-1, 0.34],
] as const;
const ELL_PTS = [[-0.7, -1], [0.02, -1], [0.02, 0.28], [0.92, 0.28], [0.92, 1], [-0.7, 1]] as const;

const scaled = (c: Pt, r: number, pts: readonly (readonly [number, number])[]): Pt[] =>
  pts.map(([x, y]) => ({ x: c.x + x * r, y: c.y + y * r }));

function shapeGeom(shape: ShapeName, c: Pt, r: number): Geom {
  switch (shape) {
    case "circle":
      return { kind: "circle", c, r };
    // An oval is drawn as a many-sided outline rather than an ellipse, so that
    // it turns, mirrors and can be cut in half through the same code as every
    // other shape here.
    case "oval":
      return { kind: "poly", pts: polygonPts(c, r, 28).map((p) => ({ x: c.x + (p.x - c.x) * 1.3, y: c.y + (p.y - c.y) * 0.72 })) };
    case "square": {
      const s = r * 0.86;
      return { kind: "poly", pts: [
        { x: c.x - s, y: c.y - s }, { x: c.x + s, y: c.y - s },
        { x: c.x + s, y: c.y + s }, { x: c.x - s, y: c.y + s },
      ] };
    }
    case "triangle":
      return { kind: "poly", pts: polygonPts({ x: c.x, y: c.y + r * 0.12 }, r * 1.12, 3) };
    case "diamond":
      return { kind: "poly", pts: polygonPts(c, r * 1.15, 4) };
    case "hexagon":
      return { kind: "poly", pts: polygonPts(c, r, 6) };
    case "star":
      return { kind: "poly", pts: starPts(c, r * 1.15) };
    case "arrow":
      return { kind: "poly", pts: scaled(c, r, ARROW_PTS) };
    case "ell":
      return { kind: "poly", pts: scaled(c, r * 0.95, ELL_PTS) };
  }
}

/* -------------------------------------------------------------- transforms */

const mapGeom = (g: Geom, fn: (p: Pt) => Pt): Geom =>
  g.kind === "poly"
    ? { kind: "poly", pts: g.pts.map(fn) }
    : g.kind === "line"
      ? { kind: "line", a: fn(g.a), b: fn(g.b) }
      // A turn or a mirror moves a circle's centre and leaves its radius be,
      // which is exactly why a rule that only turns a lone circle shows
      // nothing: the geometry comes back identical, and `figLook` says so.
      : { kind: "circle", c: fn(g.c), r: g.r };

function turnPt(p: Pt, about: Pt, quarters: number): Pt {
  let x = p.x - about.x;
  let y = p.y - about.y;
  // Screen coordinates run y downwards, so (x, y) -> (-y, x) is the quarter
  // turn a child would call clockwise.
  for (let i = 0; i < quarters; i++) {
    const nx = -y;
    y = x;
    x = nx;
  }
  return { x: about.x + x, y: about.y + y };
}

const flipPt = (p: Pt, aboutX: number): Pt => ({ x: 2 * aboutX - p.x, y: p.y });

/** The part of a polygon on the far side of a vertical cut (Sutherland-Hodgman). */
function clipRight(pts: Pt[], x0: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i];
    const prev = pts[(i - 1 + pts.length) % pts.length];
    const curIn = cur.x >= x0;
    const prevIn = prev.x >= x0;
    if (curIn !== prevIn) {
      const t = (x0 - prev.x) / (cur.x - prev.x);
      out.push({ x: x0, y: prev.y + t * (cur.y - prev.y) });
    }
    if (curIn) out.push(cur);
  }
  return out;
}

/** Corner-to-corner joins between a figure's two faces, for the solid look. */
function joins(front: Geom, back: Geom): [Pt, Pt][] {
  if (front.kind === "poly" && back.kind === "poly") {
    return front.pts.map((p, i) => [p, back.pts[i]] as [Pt, Pt]);
  }
  if (front.kind === "circle" && back.kind === "circle") {
    // A cylinder joins along the two lines that graze both rims, which are
    // square to the offset between the centres.
    const dx = back.c.x - front.c.x;
    const dy = back.c.y - front.c.y;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    return [1, -1].map((s) => [
      { x: front.c.x + s * px * front.r, y: front.c.y + s * py * front.r },
      { x: back.c.x + s * px * back.r, y: back.c.y + s * py * back.r },
    ] as [Pt, Pt]);
  }
  return [];
}

/** Open and solid are each other's opposite; a half tone reads against either. */
export const opposite = (s: Shading): Shading => (s === "solid" ? "open" : "solid");

/* --------------------------------------------------------------- assembly */

/**
 * Everything one shape of a figure draws.
 *
 * `spin` turns this shape alone, about its own centre, before the figure's own
 * turn is applied to all of them together -- which is what lets one arrow in a
 * row of three face the other way.
 */
function unitMarks(f: Fig, c: Pt, r: number, spin = 0): Mark[] {
  const out: Mark[] = [];
  const geom = shapeGeom(f.shape, c, r);
  const off = r * 0.4;

  if (f.ghost) {
    out.push({ geom: mapGeom(geom, (p) => ({ x: p.x - off, y: p.y + off })), shading: "open" });
  }
  if (f.extruded) {
    const back = mapGeom(geom, (p) => ({ x: p.x + off, y: p.y - off }));
    out.push({ geom: back, shading: f.shading });
    for (const [p, q] of joins(geom, back)) out.push({ geom: { kind: "line", a: p, b: q }, shading: "open" });
  }
  out.push({ geom, shading: f.shading });
  if (f.split && geom.kind === "poly") {
    const half = clipRight(geom.pts, c.x);
    if (half.length > 2) out.push({ geom: { kind: "poly", pts: half }, shading: opposite(f.shading) });
  }
  if (f.inner) {
    const ir = r * 0.36;
    if (f.inner.at === "inside") {
      const gap = ir * 2.3;
      const start = c.x - ((f.inner.count - 1) * gap) / 2;
      for (let i = 0; i < f.inner.count; i++) {
        out.push({ geom: shapeGeom(f.inner.shape, { x: start + i * gap, y: c.y }, ir), shading: "solid" });
      }
    } else {
      out.push({ geom: shapeGeom(f.inner.shape, { x: c.x, y: c.y - r - ir * 1.3 }, ir), shading: "solid" });
    }
  }
  if (!spin) return out;
  return out.map((m) => ({ geom: mapGeom(m.geom, (p) => turnPt(p, c, spin)), shading: m.shading }));
}

/**
 * Every primitive a figure draws, in order, already turned and mirrored.
 *
 * The turn and the flip act on the assembled figure rather than on each shape
 * in it, so a row of three swings round to a column and a shape wearing
 * something above it carries that round too. Anything else would be a
 * different rule for every figure the rule met.
 */
function figUnits(f: Fig, cx: number, cy: number, unit: number): Mark[][] {
  const out: Mark[][] = [];
  if (f.pair) {
    const gap = unit * 2.7;
    const radii = f.pair === "big-small" ? [unit, unit * 0.55] : [unit * 0.55, unit];
    for (let i = 0; i < 2; i++) {
      out.push(unitMarks(f, { x: cx + (i - 0.5) * gap, y: cy }, radii[i]));
    }
  } else {
    const r = unit * (f.size === 2 ? 1 : 0.6);
    const gap = unit * 2.3;
    const start = cx - ((f.count - 1) * gap) / 2;
    for (let i = 0; i < f.count; i++) {
      // The odd one out is the middle of three, and nothing else.
      const odd = f.odd && f.count === 3 && i === 1 ? f.odd : null;
      const self = odd?.shape ? { ...f, shape: odd.shape } : f;
      out.push(unitMarks(
        self,
        { x: start + i * gap, y: cy },
        odd?.smaller ? r * 0.55 : r,
        odd?.turn ?? 0,
      ));
    }
  }

  const about = { x: cx, y: cy };
  const turn = f.turn ?? 0;
  if (!turn && !f.flip) return out;
  return out.map((marks) =>
    marks.map((m) => {
      let g = m.geom;
      if (turn) g = mapGeom(g, (p) => turnPt(p, about, turn));
      if (f.flip) g = mapGeom(g, (p) => flipPt(p, cx));
      return { geom: g, shading: m.shading };
    }),
  );
}

/**
 * One decimal place, and never "-0.0".
 *
 * A cosine of ninety degrees comes back as a speck rather than a nought, so a
 * point on the axis lands on either side of zero depending on which way it was
 * turned. Left alone, a half-turned hexagon would compare unequal to itself
 * over a rounding sign.
 */
function n1(v: number): string {
  const out = v.toFixed(1);
  return out === "-0.0" ? "0.0" : out;
}

function draw(m: Mark): string {
  const style = `${paint(m.shading)} stroke="var(--kx-fig-stroke)" stroke-width="2" stroke-linejoin="round"`;
  switch (m.geom.kind) {
    case "circle":
      return `<circle cx="${n1(m.geom.c.x)}" cy="${n1(m.geom.c.y)}" r="${n1(m.geom.r)}" ${style}/>`;
    case "line":
      return `<line x1="${n1(m.geom.a.x)}" y1="${n1(m.geom.a.y)}" x2="${n1(m.geom.b.x)}" y2="${n1(m.geom.b.y)}"
        stroke="var(--kx-fig-stroke)" stroke-width="1.6" opacity="0.85"/>`;
    case "poly":
      return `<polygon points="${m.geom.pts.map((p) => `${n1(p.x)},${n1(p.y)}`).join(" ")}" ${style}/>`;
  }
}

/** The figure's shapes, laid out centred on (cx, cy). */
export function figElements(f: Fig, cx: number, cy: number, unit: number): string {
  return figUnits(f, cx, cy, unit).flat().map(draw).join("");
}

/**
 * One drawn primitive, as the eye takes it: rounded, and with a polygon's
 * corners sorted.
 *
 * Sorting matters more than it looks. A square turned three quarters is drawn
 * from the same four corners read from a different one, and a mirrored star
 * from the same ten in the opposite direction -- so comparing the emitted
 * points would report a change that nothing on the page shows. Sorting does
 * give up one distinction, between two outlines through the same corners in a
 * different order, and nothing here draws a figure that way.
 */
function markKey(m: Mark): string {
  const pt = (p: Pt) => `${n1(p.x)},${n1(p.y)}`;
  switch (m.geom.kind) {
    case "circle":
      return `${m.shading}:c:${pt(m.geom.c)}:${n1(m.geom.r)}`;
    case "line":
      return `${m.shading}:l:${[pt(m.geom.a), pt(m.geom.b)].sort().join(" ")}`;
    case "poly":
      return `${m.shading}:p:${m.geom.pts.map(pt).sort().join(" ")}`;
  }
}

/**
 * What a figure actually draws.
 *
 * Two figures with the same look are the same picture, whatever their
 * attributes say -- a turned circle, a half-turned hexagon, a mirrored star.
 * Both of the places this matters are places an item breaks quietly: a rule
 * that does nothing visible makes the answer indistinguishable from the
 * question, and two options that draw the same make one of them unmarkable.
 */
export function figLook(f: Fig): string {
  // Sorted between shapes, in order within one. A figure is a set of shapes on
  // a page and the order they were drawn in is not something anyone can see --
  // mirroring a row of two hands back the same two circles, listed the other
  // way round, and comparing the lists in order would call that a change.
  // Inside a single shape the order is the stacking: an empty copy behind a
  // shape and one in front of it are different pictures.
  return figUnits(f, 0, 0, 20)
    .map((marks) => marks.map(markKey).join("|"))
    .sort()
    .join(";");
}

export const sameLook = (a: Fig, b: Fig): boolean => figLook(a) === figLook(b);

/* ------------------------------------------------------------ standalone */

/**
 * Figures are drawn in a square box, not the wide strip they once were: a
 * figure that turns a quarter turn puts its long side where its short side
 * was, and a box that only fitted the row would clip the column.
 */
const BOX = 116;
const UNIT = 15;

/** One figure on its own, sized so every figure in a question matches. */
export function figSvg(f: Fig): string {
  return `<svg viewBox="0 0 ${BOX} ${BOX}" role="img" aria-label="${describe(f)}">
    ${figElements(f, BOX / 2, BOX / 2, UNIT)}
  </svg>`;
}

/** Several figures side by side in their own boxes, e.g. "which one belongs?" */
export function figRowSvg(figs: Fig[]): string {
  const cell = 88;
  const W = cell * figs.length;
  const cells = figs
    .map((f, i) => {
      const x = i * cell;
      return `<rect x="${x + 3}" y="3" width="${cell - 6}" height="${cell - 6}" rx="6"
        fill="none" stroke="var(--kx-fig-stroke)" stroke-width="1.5" opacity="0.5"/>
      ${figElements(f, x + cell / 2, cell / 2, 12)}`;
    })
    .join("");
  return `<svg viewBox="0 0 ${W} ${cell}" role="img" aria-label="${figs.map(describe).join("; then ")}">
    ${cells}
  </svg>`;
}

/**
 * A figure analogy: `a` becomes `b`, so `c` becomes what?
 *
 * Two rows inside one frame, the worked pair above the pair to finish, which
 * is how the practice books print it and how the picture and number analogies
 * here already read. Strung across a single line -- which this was -- the four
 * boxes read as one sequence, and a child has to work out where the first pair
 * ends before they can start on the rule. Stacked, the pairing is the layout.
 *
 * The arrows stay. A matrix is an analogy in a grid, but the arrow says out
 * loud which way the rule runs, and a child who cannot yet read has nothing
 * else to tell them.
 */
export function analogyGridSvg(a: Fig, b: Fig, c: Fig): string {
  const cell = 76;
  const span = 26;
  const pad = 9;
  const rowGap = 10;
  const W = pad * 2 + cell * 2 + span;
  const H = pad * 2 + cell * 2 + rowGap;
  const right = pad + cell + span;

  const box = (x: number, y: number, inner: string) =>
    `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="6"
      fill="none" stroke="var(--kx-fig-stroke)" stroke-width="1.5" opacity="0.5"/>${inner}`;
  const at = (f: Fig, x: number, y: number) => figElements(f, x + cell / 2, y + cell / 2, 10);
  const arrowAt = (x: number, y: number) =>
    `<path d="M ${x + 4} ${y} h ${span - 12} m -6 -5 l 6 5 l -6 5"
      fill="none" stroke="var(--kx-fig-stroke)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  const row = (y: number, left: Fig, filled?: Fig) =>
    `${box(pad, y, at(left, pad, y))}
     ${arrowAt(pad + cell, y + cell / 2)}
     ${box(right, y, filled
       ? at(filled, right, y)
       : `<text x="${right + cell / 2}" y="${y + cell / 2 + 10}" text-anchor="middle"
           font-size="28" font-weight="700" fill="var(--kx-fig-stroke)">?</text>`)}`;

  return `<svg viewBox="0 0 ${W} ${H}" role="img" class="kx-fig-block"
    aria-label="${describe(a)} becomes ${describe(b)}. In the same way, ${describe(c)} becomes a missing figure.">
    <rect x="0.75" y="0.75" width="${W - 1.5}" height="${H - 1.5}" rx="8"
      fill="none" stroke="var(--kx-fig-stroke)" stroke-width="1.5" opacity="0.45"/>
    ${row(pad, a, b)}
    ${row(pad + cell + rowGap, c)}
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
