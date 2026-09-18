import type { GradeInfo, Skill, Subject } from "./types";

export const GRADES: GradeInfo[] = [
  { grade: 0, label: "Kindergarten", short: "K" },
  { grade: 1, label: "First grade", short: "1" },
  { grade: 2, label: "Second grade", short: "2" },
  { grade: 3, label: "Third grade", short: "3" },
  { grade: 4, label: "Fourth grade", short: "4" },
  { grade: 5, label: "Fifth grade", short: "5" },
  { grade: 6, label: "Sixth grade", short: "6" },
  { grade: 7, label: "Seventh grade", short: "7" },
  { grade: 8, label: "Eighth grade", short: "8" },
  { grade: 9, label: "Algebra 1", short: "A1" },
];

export const SUBJECTS: { id: Subject; name: string; blurb: string }[] = [
  { id: "math", name: "Math", blurb: "Counting through Algebra 1 — every skill adapts as you go." },
  { id: "ela", name: "Language arts", blurb: "Vocabulary, grammar, and reading comprehension." },
];

export const MATH_STRANDS = [
  "Numbers & Operations",
  "Fractions & Decimals",
  "Algebra & Patterns",
  "Geometry & Measurement",
  "Data & Probability",
] as const;

export const ELA_STRANDS = ["Vocabulary", "Grammar & Mechanics", "Reading Comprehension"] as const;

type Draft = {
  name: string;
  strand: string;
  generator: string;
  params?: Skill["params"];
  levels?: number;
};

const m = (name: string, strand: (typeof MATH_STRANDS)[number], generator: string, params?: Skill["params"], levels?: number): Draft =>
  ({ name, strand, generator, params, levels });
const e = (name: string, strand: (typeof ELA_STRANDS)[number], generator: string, params?: Skill["params"], levels?: number): Draft =>
  ({ name, strand, generator, params, levels });

const MATH_BY_GRADE: Record<number, Draft[]> = {
  0: [
    m("Count objects to 10", "Numbers & Operations", "count-objects"),
    m("Compare numbers to 20", "Numbers & Operations", "compare-numbers"),
    m("Addition within 10", "Numbers & Operations", "add-within", { max: 10 }),
    m("Subtraction within 10", "Numbers & Operations", "sub-within", { max: 10 }),
    m("Name the shape's area", "Geometry & Measurement", "area-perimeter", { shape: "rectangle", measure: "area" }),
  ],
  1: [
    m("Addition within 20", "Numbers & Operations", "add-within", { max: 20 }),
    m("Subtraction within 20", "Numbers & Operations", "sub-within", { max: 20 }),
    m("Compare two-digit numbers", "Numbers & Operations", "compare-numbers"),
    m("Place value: tens and ones", "Numbers & Operations", "place-value"),
    m("Patterns: what comes next?", "Algebra & Patterns", "sequences"),
    m("Perimeter of rectangles", "Geometry & Measurement", "area-perimeter", { shape: "rectangle", measure: "perimeter" }),
  ],
  2: [
    m("Two-digit addition", "Numbers & Operations", "multi-digit-add", { digits: 2 }),
    m("Two-digit subtraction", "Numbers & Operations", "multi-digit-sub", { digits: 2 }),
    m("Place value to hundreds", "Numbers & Operations", "place-value"),
    m("Round to the nearest ten", "Numbers & Operations", "rounding"),
    m("Skip-counting patterns", "Algebra & Patterns", "sequences"),
    m("Area of rectangles", "Geometry & Measurement", "area-perimeter", { shape: "rectangle", measure: "area" }),
    m("Measurement conversions", "Geometry & Measurement", "unit-conversion"),
    m("Range of a data set", "Data & Probability", "mean-median-mode", { stat: "range" }),
  ],
  3: [
    m("Multiplication facts", "Numbers & Operations", "multiplication-facts", { max: 10 }),
    m("Division facts", "Numbers & Operations", "division-facts", { max: 10 }),
    m("Three-digit addition", "Numbers & Operations", "multi-digit-add", { digits: 3 }),
    m("Three-digit subtraction", "Numbers & Operations", "multi-digit-sub", { digits: 3 }),
    m("Round to the nearest hundred", "Numbers & Operations", "rounding"),
    m("Compare fractions", "Fractions & Decimals", "fraction-compare"),
    m("Fractions of a group", "Fractions & Decimals", "fraction-of-number"),
    m("Area and perimeter", "Geometry & Measurement", "area-perimeter", { shape: "rectangle" }),
    m("Simple probability", "Data & Probability", "probability"),
  ],
  4: [
    m("Multi-digit multiplication", "Numbers & Operations", "multi-digit-multiply"),
    m("Long division", "Numbers & Operations", "long-division"),
    m("Factors and multiples", "Numbers & Operations", "gcf-lcm"),
    m("Add fractions with like denominators", "Fractions & Decimals", "fraction-add", { like: true }),
    m("Multiply fractions", "Fractions & Decimals", "fraction-multiply"),
    m("Add and subtract decimals", "Fractions & Decimals", "decimal-ops", { op: "+" }),
    m("Function tables", "Algebra & Patterns", "function-table"),
    m("Angles in a triangle", "Geometry & Measurement", "angles"),
    m("Area of triangles", "Geometry & Measurement", "area-perimeter", { shape: "triangle", measure: "area" }),
    m("Mean of a data set", "Data & Probability", "mean-median-mode", { stat: "mean" }),
  ],
  5: [
    m("Order of operations", "Numbers & Operations", "order-of-operations"),
    m("Powers and exponents", "Numbers & Operations", "exponents"),
    m("Add fractions with unlike denominators", "Fractions & Decimals", "fraction-add"),
    m("Divide fractions", "Fractions & Decimals", "fraction-multiply", { op: "div" }),
    m("Multiply decimals", "Fractions & Decimals", "decimal-ops", { op: "×" }),
    m("Fractions, decimals, and percents", "Fractions & Decimals", "decimal-fraction-percent"),
    m("Evaluate expressions", "Algebra & Patterns", "evaluate-expression"),
    m("Volume of rectangular prisms", "Geometry & Measurement", "volume"),
    m("Points on a coordinate grid", "Geometry & Measurement", "coordinate-plane", { firstQuadrant: true }),
    m("Median and range", "Data & Probability", "mean-median-mode", { stat: "median" }),
  ],
  6: [
    m("Greatest common factor", "Numbers & Operations", "gcf-lcm", { mode: "gcf" }),
    m("Least common multiple", "Numbers & Operations", "gcf-lcm", { mode: "lcm" }),
    m("Absolute value", "Numbers & Operations", "absolute-value"),
    m("Percent of a number", "Fractions & Decimals", "percent-of-number"),
    m("Ratios and proportions", "Fractions & Decimals", "ratio-proportion"),
    m("Unit rates", "Fractions & Decimals", "unit-rate"),
    m("One-step equations", "Algebra & Patterns", "one-step-equation"),
    m("Write and evaluate expressions", "Algebra & Patterns", "evaluate-expression"),
    m("Area of circles", "Geometry & Measurement", "area-perimeter", { shape: "circle", measure: "area" }),
    m("Quadrants of the coordinate plane", "Geometry & Measurement", "coordinate-plane"),
    m("Mean, median, and range", "Data & Probability", "mean-median-mode"),
    m("Probability of a single event", "Data & Probability", "probability"),
  ],
  7: [
    m("Operations with integers", "Numbers & Operations", "integer-ops"),
    m("Percent increase and decrease", "Fractions & Decimals", "percent-change"),
    m("Proportional relationships", "Fractions & Decimals", "ratio-proportion"),
    m("Two-step equations", "Algebra & Patterns", "two-step-equation"),
    m("One-step inequalities", "Algebra & Patterns", "inequality"),
    m("Circumference of circles", "Geometry & Measurement", "area-perimeter", { shape: "circle", measure: "perimeter" }),
    m("Volume and surface area", "Geometry & Measurement", "volume"),
    m("Complementary and supplementary angles", "Geometry & Measurement", "angles"),
    m("Rate word problems", "Data & Probability", "word-problem-rate"),
    m("Probability", "Data & Probability", "probability"),
  ],
  8: [
    m("Scientific notation", "Numbers & Operations", "scientific-notation"),
    m("Exponent rules", "Numbers & Operations", "exponents"),
    m("Solve two-step equations", "Algebra & Patterns", "two-step-equation"),
    m("Find the slope", "Algebra & Patterns", "slope-from-points"),
    m("Slope-intercept form", "Algebra & Patterns", "slope-intercept"),
    m("Linear function tables", "Algebra & Patterns", "function-table"),
    m("The Pythagorean theorem", "Geometry & Measurement", "pythagorean"),
    m("Volume of prisms", "Geometry & Measurement", "volume"),
    m("Points on the coordinate plane", "Geometry & Measurement", "coordinate-plane"),
    m("Mean, median, mode, and range", "Data & Probability", "mean-median-mode"),
  ],
  9: [
    m("Evaluate algebraic expressions", "Algebra & Patterns", "evaluate-expression"),
    m("Solve multi-step equations", "Algebra & Patterns", "two-step-equation"),
    m("Solve inequalities", "Algebra & Patterns", "inequality"),
    m("Slope and rate of change", "Algebra & Patterns", "slope-from-points"),
    m("Slope-intercept form", "Algebra & Patterns", "slope-intercept"),
    m("Systems of equations", "Algebra & Patterns", "system-of-equations"),
    m("Factor quadratics", "Algebra & Patterns", "factor-quadratic"),
    m("Arithmetic and geometric sequences", "Algebra & Patterns", "sequences"),
    m("Properties of exponents", "Numbers & Operations", "exponents"),
    m("The Pythagorean theorem", "Geometry & Measurement", "pythagorean"),
  ],
};

const ELA_BY_GRADE: Record<number, Draft[]> = {
  2: [
    e("Synonyms", "Vocabulary", "synonyms-antonyms", { mode: "synonym" }),
    e("Plural nouns", "Grammar & Mechanics", "plurals"),
    e("Capitalization", "Grammar & Mechanics", "capitalization"),
    e("Nouns, verbs, and adjectives", "Grammar & Mechanics", "parts-of-speech"),
  ],
  3: [
    e("Synonyms and antonyms", "Vocabulary", "synonyms-antonyms"),
    e("Prefixes and suffixes", "Vocabulary", "prefix-suffix"),
    e("Commonly confused words", "Grammar & Mechanics", "homophones"),
    e("Parts of speech", "Grammar & Mechanics", "parts-of-speech"),
    e("Irregular plurals", "Grammar & Mechanics", "plurals"),
  ],
  4: [
    e("Antonyms", "Vocabulary", "synonyms-antonyms", { mode: "antonym" }),
    e("Word parts", "Vocabulary", "prefix-suffix"),
    e("Subject-verb agreement", "Grammar & Mechanics", "subject-verb-agreement"),
    e("Complete sentences and fragments", "Grammar & Mechanics", "sentence-type"),
    e("Determine the main idea", "Reading Comprehension", "main-idea"),
  ],
  5: [
    e("Context clues", "Vocabulary", "context-clues"),
    e("Prefixes, suffixes, and roots", "Vocabulary", "prefix-suffix"),
    e("Commas and end punctuation", "Grammar & Mechanics", "punctuation"),
    e("Verb tenses", "Grammar & Mechanics", "verb-tense"),
    e("Main idea and supporting details", "Reading Comprehension", "main-idea"),
    e("Figurative language", "Reading Comprehension", "figurative-language"),
  ],
  6: [
    e("Analogies", "Vocabulary", "analogies"),
    e("Context clues", "Vocabulary", "context-clues"),
    e("Pronoun-antecedent agreement", "Grammar & Mechanics", "pronoun-antecedent"),
    e("Run-on sentences and fragments", "Grammar & Mechanics", "sentence-type"),
    e("Figurative language", "Reading Comprehension", "figurative-language"),
  ],
  7: [
    e("Advanced analogies", "Vocabulary", "analogies"),
    e("Determine word meaning from context", "Vocabulary", "context-clues"),
    e("Semicolons, colons, and commas", "Grammar & Mechanics", "punctuation"),
    e("Subject-verb agreement", "Grammar & Mechanics", "subject-verb-agreement"),
    e("Central idea of a passage", "Reading Comprehension", "main-idea"),
  ],
  8: [
    e("Academic vocabulary in context", "Vocabulary", "context-clues"),
    e("Synonyms and shades of meaning", "Vocabulary", "synonyms-antonyms"),
    e("Punctuation in complex sentences", "Grammar & Mechanics", "punctuation"),
    e("Verb tense consistency", "Grammar & Mechanics", "verb-tense"),
    e("Analyze the central idea", "Reading Comprehension", "main-idea"),
    e("Figurative and connotative meaning", "Reading Comprehension", "figurative-language"),
  ],
};

/** Letters used for IXL-style skill codes within a grade: A.1, A.2, B.1 ... */
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function build(): Skill[] {
  const out: Skill[] = [];
  for (const [subject, table] of [
    ["math", MATH_BY_GRADE],
    ["ela", ELA_BY_GRADE],
  ] as const) {
    for (const [gradeStr, drafts] of Object.entries(table)) {
      const grade = Number(gradeStr);
      const strandOrder: string[] = [];
      const counters = new Map<string, number>();
      for (const d of drafts) {
        if (!strandOrder.includes(d.strand)) strandOrder.push(d.strand);
        const n = (counters.get(d.strand) ?? 0) + 1;
        counters.set(d.strand, n);
        const letter = LETTERS[strandOrder.indexOf(d.strand)];
        const code = `${letter}.${n}`;
        out.push({
          id: `${subject}-${grade}-${slug(d.name)}`,
          code,
          name: d.name,
          subject: subject as Subject,
          grade,
          strand: d.strand,
          generator: d.generator,
          params: d.params,
          levels: d.levels ?? 4,
        });
      }
    }
  }
  return out;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const SKILLS: Skill[] = build();

const BY_ID = new Map(SKILLS.map((s) => [s.id, s]));

export function getSkill(id: string): Skill | undefined {
  return BY_ID.get(id);
}

export function skillsFor(subject: Subject, grade: number): Skill[] {
  return SKILLS.filter((s) => s.subject === subject && s.grade === grade);
}

export function gradesFor(subject: Subject): GradeInfo[] {
  const present = new Set(SKILLS.filter((s) => s.subject === subject).map((s) => s.grade));
  return GRADES.filter((g) => present.has(g.grade));
}

/** Group a grade's skills by strand, preserving catalog order. */
export function byStrand(skills: Skill[]): { strand: string; skills: Skill[] }[] {
  const groups = new Map<string, Skill[]>();
  for (const s of skills) {
    const list = groups.get(s.strand) ?? [];
    list.push(s);
    groups.set(s.strand, list);
  }
  return [...groups.entries()].map(([strand, list]) => ({ strand, skills: list }));
}

export function gradeLabel(grade: number): string {
  return GRADES.find((g) => g.grade === grade)?.label ?? `Grade ${grade}`;
}

export function subjectName(subject: Subject): string {
  return SUBJECTS.find((s) => s.id === subject)?.name ?? subject;
}

export function searchSkills(query: string, limit = 12): Skill[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SKILLS.filter(
    (s) => s.name.toLowerCase().includes(q) || s.strand.toLowerCase().includes(q),
  ).slice(0, limit);
}
