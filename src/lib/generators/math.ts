import {
  choice, numeric, text, num, gcd, lcm, simplify, fracStr, fracAccept, round, money,
  NAMES, plural, type GeneratorFn, type Frac,
} from "./helpers";

/** Difficulty ramps: most generators scale their operand ranges off `level` (1..4+). */
const scale = (level: number, base: number, step: number) => base + (level - 1) * step;

/* ---------------------------------------------------------------- counting */

const countObjects: GeneratorFn = (rng, level) => {
  const max = scale(level, 5, 5);
  const n = rng.int(1, max);
  const [, plur] = plural(rng);
  const icons = "●".repeat(n);
  return numeric({
    instructions: "Count the dots.",
    stem: `How many ${plur} are there?\n\n${icons}`,
    answer: `${n}`,
    explanation: `Count each dot one at a time: there are ${n}.`,
    hint: "Touch each dot as you count.",
  });
};

const compareNumbers: GeneratorFn = (rng, level) => {
  const max = scale(level, 20, 80);
  const a = rng.int(0, max);
  const b = rng.intExcept(0, max, [a]);
  const answer = a > b ? ">" : "<";
  return choice(rng, {
    instructions: "Compare the two numbers.",
    stem: `Which symbol makes this true?\n\n**${a} ? ${b}**`,
    answer,
    distractors: [">", "<", "="],
    explanation: `${a} is ${a > b ? "greater" : "less"} than ${b}, so ${a} ${answer} ${b}.`,
    hint: "The open end of the symbol faces the larger number.",
  });
};

/* ------------------------------------------------------- addition/subtraction */

const addWithin: GeneratorFn = (rng, level, params) => {
  const max = num(params, "max", 20) + (level - 1) * 5;
  const a = rng.int(1, max);
  const b = rng.int(1, Math.max(1, max - a));
  return numeric({
    stem: `${a} + ${b} = ?`,
    answer: `${a + b}`,
    explanation: `Start at ${a} and count up ${b}: ${a} + ${b} = ${a + b}.`,
    hint: `Try counting on from ${Math.max(a, b)}.`,
  });
};

const subWithin: GeneratorFn = (rng, level, params) => {
  const max = num(params, "max", 20) + (level - 1) * 5;
  const a = rng.int(2, max);
  const b = rng.int(1, a);
  return numeric({
    stem: `${a} − ${b} = ?`,
    answer: `${a - b}`,
    explanation: `${a} − ${b} = ${a - b}. Check it: ${a - b} + ${b} = ${a}.`,
    hint: "Count back, or think about what adds up to the bigger number.",
  });
};

const multiDigitAdd: GeneratorFn = (rng, level, params) => {
  const digits = num(params, "digits", 2) + Math.floor((level - 1) / 2);
  const lo = 10 ** (digits - 1);
  const hi = 10 ** digits - 1;
  const a = rng.int(lo, hi);
  const b = rng.int(lo, hi);
  return numeric({
    instructions: "Add.",
    stem: `${a.toLocaleString()} + ${b.toLocaleString()} = ?`,
    answer: `${a + b}`,
    accept: [(a + b).toLocaleString()],
    explanation: `Line up the place values and add, regrouping where a column passes 9: ${a} + ${b} = ${a + b}.`,
    hint: "Add the ones column first, then carry.",
  });
};

const multiDigitSub: GeneratorFn = (rng, level, params) => {
  const digits = num(params, "digits", 2) + Math.floor((level - 1) / 2);
  const lo = 10 ** (digits - 1);
  const hi = 10 ** digits - 1;
  const a = rng.int(lo + 1, hi);
  const b = rng.int(lo, a);
  return numeric({
    instructions: "Subtract.",
    stem: `${a.toLocaleString()} − ${b.toLocaleString()} = ?`,
    answer: `${a - b}`,
    accept: [(a - b).toLocaleString()],
    explanation: `${a} − ${b} = ${a - b}. Add back to check: ${a - b} + ${b} = ${a}.`,
    hint: "Borrow from the next place when the top digit is too small.",
  });
};

/* ---------------------------------------------------- multiplication/division */

const multiplicationFacts: GeneratorFn = (rng, level, params) => {
  const max = num(params, "max", 10) + (level - 1) * 2;
  const a = rng.int(2, max);
  const b = rng.int(2, max);
  return numeric({
    stem: `${a} × ${b} = ?`,
    answer: `${a * b}`,
    explanation: `${a} × ${b} means ${a} groups of ${b}, which is ${a * b}.`,
    hint: `Skip-count by ${b}, ${a} times.`,
  });
};

const divisionFacts: GeneratorFn = (rng, level, params) => {
  const max = num(params, "max", 10) + (level - 1) * 2;
  const b = rng.int(2, max);
  const q = rng.int(2, max);
  return numeric({
    stem: `${b * q} ÷ ${b} = ?`,
    answer: `${q}`,
    explanation: `Ask: ${b} times what equals ${b * q}? Since ${b} × ${q} = ${b * q}, the answer is ${q}.`,
    hint: "Division undoes multiplication.",
  });
};

const multiDigitMultiply: GeneratorFn = (rng, level) => {
  const a = rng.int(level >= 3 ? 12 : 2, level >= 3 ? 99 : 9);
  const b = rng.int(10 + (level - 1) * 10, 30 + (level - 1) * 30);
  return numeric({
    instructions: "Multiply.",
    stem: `${a} × ${b} = ?`,
    answer: `${a * b}`,
    accept: [(a * b).toLocaleString()],
    explanation: `Break ${b} apart: ${a} × ${b} = ${a} × ${Math.floor(b / 10) * 10} + ${a} × ${b % 10} = ${a * (Math.floor(b / 10) * 10)} + ${a * (b % 10)} = ${a * b}.`,
    hint: "Multiply by the tens, then the ones, then add.",
  });
};

const longDivision: GeneratorFn = (rng, level) => {
  const divisor = rng.int(2, 4 + level * 2);
  const quotient = rng.int(10, 30 + level * 40);
  const remainder = level >= 3 ? rng.int(0, divisor - 1) : 0;
  const dividend = divisor * quotient + remainder;
  const answer = remainder ? `${quotient} R${remainder}` : `${quotient}`;
  return text({
    instructions: remainder ? "Divide. Write the remainder as R." : "Divide.",
    stem: `${dividend.toLocaleString()} ÷ ${divisor} = ?`,
    answer,
    accept: remainder
      ? [`${quotient}r${remainder}`, `${quotient} r ${remainder}`, `${quotient} remainder ${remainder}`]
      : [],
    placeholder: remainder ? "e.g. 12 R3" : "quotient",
    explanation: `${divisor} × ${quotient} = ${divisor * quotient}${remainder ? `, leaving ${remainder} left over` : ""}. So ${dividend} ÷ ${divisor} = ${answer}.`,
    hint: "How many whole groups of the divisor fit?",
  });
};

/* ------------------------------------------------------------- number sense */

const placeValue: GeneratorFn = (rng, level) => {
  const places = ["ones", "tens", "hundreds", "thousands", "ten thousands"];
  const digits = Math.min(3 + level, 6);
  const n = rng.int(10 ** (digits - 1), 10 ** digits - 1);
  const idx = rng.int(0, Math.min(digits - 1, places.length - 1));
  const digit = Math.floor(n / 10 ** idx) % 10;
  return numeric({
    instructions: "Identify the digit.",
    stem: `What digit is in the **${places[idx]}** place of ${n.toLocaleString()}?`,
    answer: `${digit}`,
    explanation: `Counting from the right, the ${places[idx]} place holds ${digit}.`,
    hint: "Start from the rightmost digit and move left.",
  });
};

const rounding: GeneratorFn = (rng, level) => {
  const place = [10, 100, 1000, 10000][Math.min(level - 1, 3)];
  const label = { 10: "ten", 100: "hundred", 1000: "thousand", 10000: "ten thousand" }[place]!;
  const n = rng.int(place, place * 100);
  const rounded = Math.round(n / place) * place;
  return numeric({
    instructions: `Round to the nearest ${label}.`,
    stem: `Round **${n.toLocaleString()}** to the nearest ${label}.`,
    answer: `${rounded}`,
    accept: [rounded.toLocaleString()],
    explanation: `Look at the digit to the right of the ${label}s place. ${n} rounds to ${rounded.toLocaleString()}.`,
    hint: "5 or more rounds up; 4 or less rounds down.",
  });
};

const gcfLcm: GeneratorFn = (rng, level, params) => {
  const wantGcf = params["mode"] === "gcf" || (params["mode"] === undefined && rng.bool());
  const a = rng.int(4, 12 + level * 6);
  const b = rng.int(4, 12 + level * 6);
  const answer = wantGcf ? gcd(a, b) : lcm(a, b);
  return numeric({
    instructions: wantGcf ? "Find the greatest common factor." : "Find the least common multiple.",
    stem: `What is the ${wantGcf ? "GCF" : "LCM"} of **${a}** and **${b}**?`,
    answer: `${answer}`,
    explanation: wantGcf
      ? `The largest number dividing both ${a} and ${b} is ${answer}.`
      : `The smallest number both ${a} and ${b} divide into is ${answer}.`,
    hint: wantGcf ? "List the factors of each and find the biggest shared one." : "Count multiples of the larger number until the smaller one divides it.",
  });
};

const absoluteValue: GeneratorFn = (rng, level) => {
  const a = rng.intExcept(-(10 + level * 10), 10 + level * 10, [0]);
  return numeric({
    instructions: "Evaluate.",
    stem: `| ${a} | = ?`,
    answer: `${Math.abs(a)}`,
    explanation: `Absolute value is distance from zero, which is never negative: |${a}| = ${Math.abs(a)}.`,
    hint: "Distance from zero on the number line.",
  });
};

const integerOps: GeneratorFn = (rng, level) => {
  const a = rng.intExcept(-(9 + level * 6), 9 + level * 6, [0]);
  const b = rng.intExcept(-(9 + level * 6), 9 + level * 6, [0]);
  const op = rng.pick(level >= 3 ? ["+", "−", "×"] : ["+", "−"]);
  const value = op === "+" ? a + b : op === "−" ? a - b : a * b;
  const bStr = b < 0 ? `(${b})` : `${b}`;
  return numeric({
    instructions: "Evaluate.",
    stem: `${a} ${op} ${bStr} = ?`,
    answer: `${value}`,
    explanation:
      op === "×"
        ? `Signs: ${a < 0 === b < 0 ? "same signs give a positive" : "different signs give a negative"} product. ${a} × ${b} = ${value}.`
        : `${a} ${op} ${bStr} = ${value}. Moving ${op === "+" ? (b < 0 ? "left" : "right") : b < 0 ? "right" : "left"} on the number line.`,
    hint: "Watch the signs before you compute.",
  });
};

const orderOfOperations: GeneratorFn = (rng, level) => {
  const a = rng.int(2, 9);
  const b = rng.int(2, 9);
  const c = rng.int(2, 9);
  const d = rng.int(2, 6);
  let stem: string;
  let value: number;
  if (level <= 2) {
    stem = `${a} + ${b} × ${c}`;
    value = a + b * c;
  } else if (level === 3) {
    stem = `(${a} + ${b}) × ${c} − ${d}`;
    value = (a + b) * c - d;
  } else {
    stem = `${a} + ${b} × (${c} − ${d}) ^ 2`;
    value = a + b * (c - d) ** 2;
  }
  return numeric({
    instructions: "Evaluate using the order of operations.",
    stem: `**${stem} = ?**`,
    answer: `${value}`,
    explanation: `Parentheses, then exponents, then × and ÷, then + and −. ${stem} = ${value}.`,
    hint: "PEMDAS — parentheses before multiplication.",
  });
};

const exponents: GeneratorFn = (rng, level) => {
  const base = rng.int(2, 4 + level);
  const exp = rng.int(2, level >= 3 ? 4 : 3);
  return numeric({
    instructions: "Evaluate the power.",
    stem: `${base}^${exp} = ?`,
    answer: `${base ** exp}`,
    explanation: `${base}^${exp} means ${Array(exp).fill(base).join(" × ")} = ${base ** exp}.`,
    hint: "The exponent counts how many times the base is multiplied.",
  });
};

const scientificNotation: GeneratorFn = (rng, level) => {
  const mantissa = rng.int(10, 99) / 10;
  const exp = rng.int(2, 3 + level);
  const value = mantissa * 10 ** exp;
  return text({
    instructions: "Write the number in scientific notation.",
    stem: `**${value.toLocaleString()}**`,
    answer: `${mantissa} x 10^${exp}`,
    accept: [`${mantissa}x10^${exp}`, `${mantissa} × 10^${exp}`, `${mantissa}*10^${exp}`, `${mantissa}e${exp}`],
    placeholder: "e.g. 3.4 x 10^5",
    explanation: `Move the decimal point until one non-zero digit sits in front of it: ${value.toLocaleString()} = ${mantissa} × 10^${exp}.`,
    hint: "The first factor must be at least 1 and less than 10.",
  });
};

/* ---------------------------------------------------------------- fractions */

const fractionCompare: GeneratorFn = (rng, level) => {
  const d1 = rng.int(2, 4 + level * 2);
  const d2 = level <= 1 ? d1 : rng.int(2, 4 + level * 2);
  const n1 = rng.int(1, d1 - 1);
  const n2 = rng.int(1, Math.max(1, d2 - 1));
  const v1 = n1 / d1;
  const v2 = n2 / d2;
  const answer = v1 > v2 ? ">" : v1 < v2 ? "<" : "=";
  return choice(rng, {
    instructions: "Compare the fractions.",
    stem: `Which symbol makes this true?\n\n**${n1}/${d1} ? ${n2}/${d2}**`,
    answer,
    distractors: [">", "<", "="],
    explanation: `Use a common denominator of ${lcm(d1, d2)}: ${n1}/${d1} = ${(n1 * lcm(d1, d2)) / d1}/${lcm(d1, d2)} and ${n2}/${d2} = ${(n2 * lcm(d1, d2)) / d2}/${lcm(d1, d2)}. So ${n1}/${d1} ${answer} ${n2}/${d2}.`,
    hint: "Rewrite both with the same denominator.",
  });
};

const fractionAdd: GeneratorFn = (rng, level, params) => {
  const like = params["like"] === true || level <= 1;
  const subtract = params["op"] === "sub" || (params["op"] === undefined && level >= 3 && rng.bool(0.4));
  const d1 = rng.int(2, 4 + level * 2);
  const d2 = like ? d1 : rng.int(2, 4 + level * 2);
  let n1 = rng.int(1, d1 - 1);
  let n2 = rng.int(1, Math.max(1, d2 - 1));
  if (subtract && n1 / d1 < n2 / d2) {
    [n1, n2] = [n2, n1];
    if (like) { /* denominators already equal */ }
  }
  const D = lcm(d1, d2);
  const N = subtract ? (n1 * D) / d1 - (n2 * D) / d2 : (n1 * D) / d1 + (n2 * D) / d2;
  const result: Frac = simplify({ n: N, d: D });
  return {
    instructions: "Write your answer in simplest form.",
    stem: `**${n1}/${d1} ${subtract ? "−" : "+"} ${n2}/${d2} = ?**`,
    format: { kind: "fraction" },
    answer: fracStr(result),
    accept: fracAccept({ n: N, d: D }),
    explanation: like
      ? `The denominators match, so ${subtract ? "subtract" : "add"} the numerators: ${n1} ${subtract ? "−" : "+"} ${n2} = ${subtract ? n1 - n2 : n1 + n2}, over ${d1}. Simplified: ${fracStr(result)}.`
      : `Rewrite both over ${D}: ${(n1 * D) / d1}/${D} ${subtract ? "−" : "+"} ${(n2 * D) / d2}/${D} = ${N}/${D} = ${fracStr(result)}.`,
    hint: like ? "Keep the denominator, combine the numerators." : `Try a common denominator of ${D}.`,
  };
};

const fractionMultiply: GeneratorFn = (rng, level, params) => {
  const divide = params["op"] === "div";
  const d1 = rng.int(2, 3 + level * 2);
  const d2 = rng.int(2, 3 + level * 2);
  const n1 = rng.int(1, d1 - 1);
  const n2 = rng.int(1, Math.max(1, d2 - 1));
  const raw: Frac = divide ? { n: n1 * d2, d: d1 * n2 } : { n: n1 * n2, d: d1 * d2 };
  const result = simplify(raw);
  return {
    instructions: "Write your answer in simplest form.",
    stem: `**${n1}/${d1} ${divide ? "÷" : "×"} ${n2}/${d2} = ?**`,
    format: { kind: "fraction" },
    answer: fracStr(result),
    accept: fracAccept(raw),
    explanation: divide
      ? `Dividing means multiplying by the reciprocal: ${n1}/${d1} × ${d2}/${n2} = ${raw.n}/${raw.d} = ${fracStr(result)}.`
      : `Multiply across: ${n1} × ${n2} = ${n1 * n2} and ${d1} × ${d2} = ${d1 * d2}, giving ${fracStr(result)}.`,
    hint: divide ? "Flip the second fraction and multiply." : "Numerator times numerator, denominator times denominator.",
  };
};

const fractionOfNumber: GeneratorFn = (rng, level) => {
  const d = rng.pick([2, 3, 4, 5, 6, 8]);
  const n = rng.int(1, d - 1);
  const whole = d * rng.int(2, 4 + level * 3);
  const [sing, plur] = plural(rng);
  const name = rng.pick(NAMES);
  const answer = (whole / d) * n;
  return numeric({
    stem: `${name} has ${whole} ${plur} and gives away ${n}/${d} of them. How many ${plur} does ${name} give away?`,
    answer: `${answer}`,
    explanation: `${whole} ÷ ${d} = ${whole / d}, so one ${sing}-share is ${whole / d}. Then ${n} × ${whole / d} = ${answer}.`,
    hint: "Divide by the denominator first, then multiply by the numerator.",
  });
};

/* ----------------------------------------------------------------- decimals */

const decimalOps: GeneratorFn = (rng, level, params) => {
  const op = String(params["op"] ?? rng.pick(["+", "−", "×"]));
  const places = level >= 3 ? 2 : 1;
  const f = 10 ** places;
  const a = rng.int(f, f * (5 + level * 5)) / f;
  const b = rng.int(f, f * (5 + level * 2)) / f;
  const value = op === "+" ? a + b : op === "−" ? a - b : a * b;
  return numeric({
    instructions: "Solve.",
    stem: `**${a} ${op} ${b} = ?**`,
    answer: round(value, 4),
    explanation:
      op === "×"
        ? `Multiply as whole numbers, then place the decimal point ${places * 2} digits from the right: ${a} × ${b} = ${round(value, 4)}.`
        : `Line up the decimal points and ${op === "+" ? "add" : "subtract"}: ${a} ${op} ${b} = ${round(value, 4)}.`,
    hint: op === "×" ? "Count the total decimal places in both factors." : "Line up the decimal points.",
  });
};

const decimalFractionPercent: GeneratorFn = (rng, level) => {
  const d = rng.pick([2, 4, 5, 10, 20, 25]);
  const n = rng.int(1, d - 1);
  const pct = (n / d) * 100;
  const mode = rng.pick(level >= 3 ? ["toPercent", "toDecimal"] : ["toPercent"]);
  if (mode === "toDecimal") {
    return numeric({
      instructions: "Convert to a decimal.",
      stem: `Write **${round(pct, 2)}%** as a decimal.`,
      answer: round(pct / 100, 4),
      explanation: `Percent means "per hundred", so divide by 100: ${round(pct, 2)}% = ${round(pct / 100, 4)}.`,
      hint: "Move the decimal point two places left.",
    });
  }
  return numeric({
    instructions: "Convert to a percent. Enter the number only.",
    stem: `Write **${n}/${d}** as a percent.`,
    answer: round(pct, 2),
    accept: [`${round(pct, 2)}%`],
    explanation: `${n} ÷ ${d} = ${round(n / d, 4)}, and ${round(n / d, 4)} × 100 = ${round(pct, 2)}%.`,
    hint: "Divide, then multiply by 100.",
  });
};

const percentOfNumber: GeneratorFn = (rng, level) => {
  const pct = rng.pick(level >= 3 ? [5, 12, 15, 18, 22, 35, 45, 65] : [10, 20, 25, 50, 75]);
  const whole = rng.int(2, 20) * (level >= 3 ? 10 : 4);
  const value = (pct / 100) * whole;
  return numeric({
    instructions: "Solve.",
    stem: `What is **${pct}%** of **${whole}**?`,
    answer: round(value, 4),
    explanation: `${pct}% = ${pct / 100}. Then ${pct / 100} × ${whole} = ${round(value, 4)}.`,
    hint: "Turn the percent into a decimal, then multiply.",
  });
};

const percentChange: GeneratorFn = (rng, level) => {
  const price = rng.int(10, 20 + level * 40);
  const pct = rng.pick([10, 15, 20, 25, 30, 40]);
  const isDiscount = rng.bool();
  const value = isDiscount ? price * (1 - pct / 100) : price * (1 + pct / 100);
  const store = rng.pick(["a jacket", "a bike", "a game", "a pair of shoes", "a backpack"]);
  return numeric({
    instructions: "Enter the amount in dollars.",
    stem: isDiscount
      ? `${store.charAt(0).toUpperCase() + store.slice(1)} costs ${money(price)}. It is on sale for **${pct}% off**. What is the sale price?`
      : `${store.charAt(0).toUpperCase() + store.slice(1)} costs ${money(price)}. The price goes **up ${pct}%**. What is the new price?`,
    answer: round(value, 2),
    accept: [money(value), value.toFixed(2)],
    explanation: `${pct}% of ${money(price)} is ${money((pct / 100) * price)}. ${isDiscount ? "Subtract" : "Add"} it: ${money(value)}.`,
    hint: isDiscount ? `Paying ${100 - pct}% is a one-step shortcut.` : `Multiply by ${1 + pct / 100}.`,
  });
};

const ratioProportion: GeneratorFn = (rng, level) => {
  const a = rng.int(2, 5 + level);
  const b = rng.int(2, 5 + level);
  const k = rng.int(2, 3 + level);
  return numeric({
    instructions: "Solve the proportion for x.",
    stem: `**${a}/${b} = x/${b * k}**`,
    answer: `${a * k}`,
    explanation: `${b} × ${k} = ${b * k}, so multiply the top by ${k} too: x = ${a} × ${k} = ${a * k}.`,
    hint: "What did the denominator get multiplied by?",
  });
};

const unitRate: GeneratorFn = (rng, level) => {
  const units = rng.int(2, 4 + level);
  const perUnit = rng.int(2, 6) + (level >= 3 ? rng.int(0, 9) / 10 : 0);
  const total = Number((units * perUnit).toFixed(2));
  const [, plur] = plural(rng);
  return numeric({
    instructions: "Find the unit rate. Enter dollars per item.",
    stem: `${units} ${plur} cost ${money(total)}. How much does **one** cost?`,
    answer: round(total / units, 2),
    accept: [money(total / units)],
    explanation: `Divide the total by the count: ${money(total)} ÷ ${units} = ${money(total / units)} each.`,
    hint: "Unit rate means 'per one'.",
  });
};

const unitConversion: GeneratorFn = (rng, level) => {
  const table = [
    { from: "feet", to: "inches", factor: 12 },
    { from: "yards", to: "feet", factor: 3 },
    { from: "meters", to: "centimeters", factor: 100 },
    { from: "kilograms", to: "grams", factor: 1000 },
    { from: "hours", to: "minutes", factor: 60 },
    { from: "minutes", to: "seconds", factor: 60 },
    { from: "liters", to: "milliliters", factor: 1000 },
    { from: "pounds", to: "ounces", factor: 16 },
  ];
  const c = rng.pick(table);
  const n = rng.int(2, 6 + level * 3);
  return numeric({
    instructions: "Convert.",
    stem: `${n} ${c.from} = ? ${c.to}`,
    answer: `${n * c.factor}`,
    accept: [(n * c.factor).toLocaleString()],
    explanation: `1 ${c.from.replace(/s$/, "")} = ${c.factor} ${c.to}, so ${n} × ${c.factor} = ${(n * c.factor).toLocaleString()}.`,
    hint: `Multiply by ${c.factor}.`,
  });
};

/* ------------------------------------------------------------------ algebra */

const evaluateExpression: GeneratorFn = (rng, level) => {
  const a = rng.int(2, 5 + level);
  const b = rng.int(1, 9 + level);
  const x = rng.int(level >= 3 ? -8 : 1, 10);
  const value = a * x + b;
  return numeric({
    instructions: `Evaluate the expression.`,
    stem: `Evaluate **${a}x + ${b}** when **x = ${x}**.`,
    answer: `${value}`,
    explanation: `Substitute: ${a}(${x}) + ${b} = ${a * x} + ${b} = ${value}.`,
    hint: "Replace x with its value, then follow the order of operations.",
  });
};

const oneStepEquation: GeneratorFn = (rng, level) => {
  const x = rng.intExcept(level >= 3 ? -12 : 1, 12, [0]);
  const k = rng.int(2, 6 + level * 2);
  const form = rng.pick(["add", "sub", "mul", "div"]);
  let stem: string;
  let explanation: string;
  switch (form) {
    case "add":
      stem = `x + ${k} = ${x + k}`;
      explanation = `Subtract ${k} from both sides: x = ${x + k} − ${k} = ${x}.`;
      break;
    case "sub":
      stem = `x − ${k} = ${x - k}`;
      explanation = `Add ${k} to both sides: x = ${x - k} + ${k} = ${x}.`;
      break;
    case "mul":
      stem = `${k}x = ${k * x}`;
      explanation = `Divide both sides by ${k}: x = ${k * x} ÷ ${k} = ${x}.`;
      break;
    default:
      stem = `x/${k} = ${x}`;
      explanation = `Multiply both sides by ${k}: x = ${x} × ${k} ÷ ${k} = ${x}.`;
  }
  return numeric({
    instructions: "Solve for x.",
    stem: `**${stem}**`,
    answer: `${x}`,
    explanation,
    hint: "Undo the operation on the same side as x.",
  });
};

const twoStepEquation: GeneratorFn = (rng, level) => {
  const x = rng.intExcept(level >= 3 ? -10 : 1, 12, [0]);
  const a = rng.int(2, 3 + level * 2);
  const b = rng.intExcept(level >= 3 ? -15 : 1, 15, [0]);
  const c = a * x + b;
  return numeric({
    instructions: "Solve for x.",
    stem: `**${a}x ${b < 0 ? "−" : "+"} ${Math.abs(b)} = ${c}**`,
    answer: `${x}`,
    explanation: `${b < 0 ? "Add" : "Subtract"} ${Math.abs(b)} on both sides: ${a}x = ${a * x}. Then divide by ${a}: x = ${x}.`,
    hint: "Undo addition/subtraction first, then the multiplication.",
  });
};

const inequality: GeneratorFn = (rng, level) => {
  const x = rng.int(1, 10);
  const a = rng.int(2, 2 + level);
  const b = rng.int(1, 10);
  const c = a * x + b;
  const sign = rng.pick([">", "<", "≥", "≤"]);
  return text({
    instructions: "Solve the inequality for x.",
    stem: `**${a}x + ${b} ${sign} ${c}**`,
    answer: `x ${sign} ${x}`,
    accept: [`x${sign}${x}`, `${sign}${x}`, `x ${sign === "≥" ? ">=" : sign === "≤" ? "<=" : sign} ${x}`],
    placeholder: `e.g. x ${sign} 5`,
    explanation: `Subtract ${b}: ${a}x ${sign} ${a * x}. Divide by ${a} (positive, so the sign stays): x ${sign} ${x}.`,
    hint: "Solve it like an equation — but flip the sign if you divide by a negative.",
  });
};

const slopeFromPoints: GeneratorFn = (rng, level) => {
  const x1 = rng.int(-6, 6);
  const dx = rng.intExcept(1, 3 + level, [0]);
  const x2 = x1 + dx;
  const m = rng.intExcept(-4, 4, [0]);
  const y1 = rng.int(-6, 6);
  const y2 = y1 + m * dx;
  return numeric({
    instructions: "Find the slope of the line through the two points.",
    stem: `**(${x1}, ${y1})** and **(${x2}, ${y2})**`,
    answer: `${m}`,
    explanation: `Slope = rise ÷ run = (${y2} − ${y1}) / (${x2} − ${x1}) = ${y2 - y1}/${dx} = ${m}.`,
    hint: "m = (y₂ − y₁) / (x₂ − x₁)",
  });
};

const slopeIntercept: GeneratorFn = (rng, level, params) => {
  const wantSlope = params["find"] === "slope" || (params["find"] === undefined && rng.bool());
  const m = rng.intExcept(-6, 6, [0]);
  const b = rng.intExcept(-9, 9, [0]);
  void level;
  return numeric({
    instructions: `Identify the ${wantSlope ? "slope" : "y-intercept"}.`,
    stem: `What is the **${wantSlope ? "slope" : "y-intercept"}** of **y = ${m}x ${b < 0 ? "−" : "+"} ${Math.abs(b)}**?`,
    answer: `${wantSlope ? m : b}`,
    explanation: `In y = mx + b, m is the slope and b is the y-intercept. Here m = ${m} and b = ${b}.`,
    hint: "Compare the equation to y = mx + b.",
  });
};

const systemOfEquations: GeneratorFn = (rng, level) => {
  const x = rng.intExcept(-6, 8, [0]);
  const y = rng.intExcept(-6, 8, [0]);
  const a1 = rng.int(1, 3), b1 = rng.intExcept(-3, 3, [0]);
  const a2 = rng.intExcept(-3, 3, [0, a1]), b2 = rng.intExcept(-3, 3, [0]);
  void level;
  const c1 = a1 * x + b1 * y;
  const c2 = a2 * x + b2 * y;
  const term = (k: number, v: string) => `${k === 1 ? "" : k === -1 ? "−" : k < 0 ? `−${Math.abs(k)}` : k}${v}`;
  return {
    instructions: "Solve the system.",
    stem: `**${term(a1, "x")} ${b1 < 0 ? "−" : "+"} ${term(Math.abs(b1), "y")} = ${c1}**\n\n**${term(a2, "x")} ${b2 < 0 ? "−" : "+"} ${term(Math.abs(b2), "y")} = ${c2}**`,
    format: { kind: "pair", labels: ["x =", "y ="] },
    answer: `${x},${y}`,
    explanation: `Eliminating one variable gives x = ${x}; substituting back gives y = ${y}.`,
    hint: "Multiply one equation so a variable cancels when you add.",
  };
};

const factorQuadratic: GeneratorFn = (rng, level) => {
  const r1 = rng.intExcept(-7, 7, [0]);
  const r2 = rng.intExcept(-7, 7, [0]);
  void level;
  const b = -(r1 + r2);
  const c = r1 * r2;
  const fmt = (r: number) => (r < 0 ? `(x + ${Math.abs(r)})` : `(x − ${r})`);
  const answer = `${fmt(r1)}${fmt(r2)}`;
  const swapped = `${fmt(r2)}${fmt(r1)}`;
  return text({
    instructions: "Factor the quadratic.",
    stem: `**x² ${b < 0 ? "−" : "+"} ${Math.abs(b)}x ${c < 0 ? "−" : "+"} ${Math.abs(c)}**`,
    answer,
    accept: [swapped, answer.replace(/−/g, "-"), swapped.replace(/−/g, "-")],
    placeholder: "e.g. (x - 3)(x + 5)",
    explanation: `Find two numbers multiplying to ${c} and adding to ${b}: ${r1} and ${r2}. So it factors as ${answer}.`,
    hint: `Look for a pair that multiplies to ${c}.`,
  });
};

const sequences: GeneratorFn = (rng, level) => {
  const geometric = level >= 3 && rng.bool(0.4);
  const start = rng.int(1, 9);
  const step = rng.int(2, 3 + level);
  const terms: number[] = [];
  for (let i = 0; i < 5; i++) terms.push(geometric ? start * step ** i : start + step * i);
  const next = geometric ? start * step ** 5 : start + step * 5;
  return numeric({
    instructions: "Find the next term in the pattern.",
    stem: `**${terms.join(", ")}, ?**`,
    answer: `${next}`,
    explanation: geometric
      ? `Each term is multiplied by ${step}. Next: ${terms[4]} × ${step} = ${next}.`
      : `Each term increases by ${step}. Next: ${terms[4]} + ${step} = ${next}.`,
    hint: "Look at what happens from one term to the next.",
  });
};

const functionTable: GeneratorFn = (rng, level) => {
  const m = rng.intExcept(-4, 5, [0]);
  const b = rng.int(-6, 9);
  const xs = rng.sample([1, 2, 3, 4, 5, 6, 7, 8], 3).sort((p, q) => p - q);
  const missing = rng.int(level >= 3 ? 6 : 9, 12);
  const rows = xs.map((x) => `| ${x} | ${m * x + b} |`).join("\n");
  return numeric({
    instructions: "Use the pattern in the table to find the missing output.",
    stem: `| x | y |\n|---|---|\n${rows}\n| ${missing} | ? |`,
    answer: `${m * missing + b}`,
    explanation: `The rule is y = ${m}x ${b < 0 ? "−" : "+"} ${Math.abs(b)}. At x = ${missing}: y = ${m * missing + b}.`,
    hint: "Find how much y changes each time x goes up by 1.",
  });
};

/* -------------------------------------------------- geometry & measurement */

const areaPerimeter: GeneratorFn = (rng, level, params) => {
  const shape = String(params["shape"] ?? rng.pick(["rectangle", "triangle", "circle"]));
  const wantArea = params["measure"] === "area" || (params["measure"] === undefined && rng.bool());
  if (shape === "circle") {
    const r = rng.int(2, 4 + level * 2);
    const value = wantArea ? Math.PI * r * r : 2 * Math.PI * r;
    return numeric({
      instructions: `Find the ${wantArea ? "area" : "circumference"}. Round to the nearest hundredth. Use π ≈ 3.14159.`,
      stem: `A circle has a radius of **${r} cm**. What is its ${wantArea ? "area" : "circumference"}?`,
      answer: round(value, 2),
      explanation: wantArea
        ? `A = πr² = π × ${r}² = π × ${r * r} ≈ ${round(value, 2)} cm².`
        : `C = 2πr = 2 × π × ${r} ≈ ${round(value, 2)} cm.`,
      hint: wantArea ? "A = πr²" : "C = 2πr",
      figure: circleFigure(r),
    });
  }
  if (shape === "triangle") {
    const b = rng.int(3, 6 + level * 3) * 2;
    const h = rng.int(3, 6 + level * 3);
    return numeric({
      instructions: "Find the area.",
      stem: `A triangle has a base of **${b} cm** and a height of **${h} cm**. What is its area in square centimeters?`,
      answer: round((b * h) / 2, 2),
      explanation: `A = ½ × base × height = ½ × ${b} × ${h} = ${round((b * h) / 2, 2)} cm².`,
      hint: "A = ½bh",
      figure: triangleFigure(b, h),
    });
  }
  const w = rng.int(2, 6 + level * 3);
  const h = rng.int(2, 6 + level * 3);
  return numeric({
    instructions: `Find the ${wantArea ? "area" : "perimeter"}.`,
    stem: `A rectangle is **${w} cm** wide and **${h} cm** tall. What is its ${wantArea ? "area in square centimeters" : "perimeter in centimeters"}?`,
    answer: `${wantArea ? w * h : 2 * (w + h)}`,
    explanation: wantArea
      ? `A = w × h = ${w} × ${h} = ${w * h} cm².`
      : `P = 2(w + h) = 2(${w} + ${h}) = ${2 * (w + h)} cm.`,
    hint: wantArea ? "Multiply the side lengths." : "Add all four sides.",
    figure: rectFigure(w, h),
  });
};

const volume: GeneratorFn = (rng, level) => {
  const l = rng.int(2, 5 + level * 2);
  const w = rng.int(2, 5 + level * 2);
  const h = rng.int(2, 5 + level * 2);
  return numeric({
    instructions: "Find the volume in cubic centimeters.",
    stem: `A rectangular prism measures **${l} cm × ${w} cm × ${h} cm**. What is its volume?`,
    answer: `${l * w * h}`,
    explanation: `V = l × w × h = ${l} × ${w} × ${h} = ${l * w * h} cm³.`,
    hint: "Multiply all three dimensions.",
  });
};

const pythagorean: GeneratorFn = (rng, level) => {
  const triples: [number, number, number][] = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [7, 24, 25]];
  const [a, b, c] = rng.pick(level >= 3 ? triples : triples.slice(0, 3));
  const findHyp = rng.bool(0.6);
  return numeric({
    instructions: "Find the missing side length.",
    stem: findHyp
      ? `A right triangle has legs of **${a}** and **${b}**. How long is the hypotenuse?`
      : `A right triangle has a hypotenuse of **${c}** and one leg of **${a}**. How long is the other leg?`,
    answer: `${findHyp ? c : b}`,
    explanation: findHyp
      ? `a² + b² = c²: ${a}² + ${b}² = ${a * a} + ${b * b} = ${c * c}, so c = ${c}.`
      : `c² − a² = b²: ${c * c} − ${a * a} = ${b * b}, so b = ${b}.`,
    hint: "a² + b² = c², where c is the hypotenuse.",
    figure: rightTriangleFigure(a, findHyp ? b : c, findHyp),
  });
};

const angles: GeneratorFn = (rng, level) => {
  const kind = rng.pick(level >= 2 ? ["complementary", "supplementary", "triangle"] : ["complementary", "supplementary"]);
  if (kind === "triangle") {
    const a = rng.int(25, 80);
    const b = rng.int(25, 175 - a);
    return numeric({
      instructions: "Find the missing angle in degrees.",
      stem: `Two angles of a triangle measure **${a}°** and **${b}°**. What is the third angle?`,
      answer: `${180 - a - b}`,
      explanation: `Angles in a triangle sum to 180°: 180 − ${a} − ${b} = ${180 - a - b}°.`,
      hint: "All three angles add to 180°.",
    });
  }
  const total = kind === "complementary" ? 90 : 180;
  const a = rng.int(15, total - 15);
  return numeric({
    instructions: "Find the missing angle in degrees.",
    stem: `Two **${kind}** angles: one measures **${a}°**. What does the other measure?`,
    answer: `${total - a}`,
    explanation: `${kind.charAt(0).toUpperCase() + kind.slice(1)} angles add to ${total}°: ${total} − ${a} = ${total - a}°.`,
    hint: `${kind === "complementary" ? "Complementary" : "Supplementary"} angles sum to ${total}°.`,
  });
};

const coordinatePlane: GeneratorFn = (rng, level) => {
  const x = rng.intExcept(-6, 6, [0]);
  const y = rng.intExcept(-6, 6, [0]);
  void level;
  const quadrant = x > 0 ? (y > 0 ? "I" : "IV") : y > 0 ? "II" : "III";
  return choice(rng, {
    instructions: "Identify the quadrant.",
    stem: `In which quadrant does the point **(${x}, ${y})** lie?`,
    answer: quadrant,
    distractors: ["I", "II", "III", "IV"],
    explanation: `x is ${x > 0 ? "positive" : "negative"} and y is ${y > 0 ? "positive" : "negative"}, which is Quadrant ${quadrant}.`,
    hint: "Quadrants are numbered counterclockwise from the top right.",
  });
};

/* ------------------------------------------------------ data & probability */

const meanMedianMode: GeneratorFn = (rng, level, params) => {
  const stat = String(params["stat"] ?? rng.pick(["mean", "median", "range"]));
  const count = level >= 3 ? 7 : 5;
  const values = Array.from({ length: count }, () => rng.int(1, 10 + level * 8));
  const sorted = [...values].sort((a, b) => a - b);
  let answer: number;
  let explanation: string;
  if (stat === "median") {
    answer = sorted[Math.floor(count / 2)];
    explanation = `Sorted: ${sorted.join(", ")}. The middle value is ${answer}.`;
  } else if (stat === "range") {
    answer = sorted[count - 1] - sorted[0];
    explanation = `Largest ${sorted[count - 1]} − smallest ${sorted[0]} = ${answer}.`;
  } else {
    const sum = values.reduce((a, b) => a + b, 0);
    answer = Number((sum / count).toFixed(2));
    explanation = `Sum = ${sum}, and ${sum} ÷ ${count} = ${answer}.`;
  }
  return numeric({
    instructions: `Find the ${stat}.`,
    stem: `**${values.join(", ")}**\n\nWhat is the ${stat} of this data set?`,
    answer: round(answer, 2),
    explanation,
    hint: stat === "median" ? "Put the numbers in order first." : stat === "range" ? "Subtract the smallest from the largest." : "Add them all, then divide by how many there are.",
  });
};

const probability: GeneratorFn = (rng, level) => {
  const colors = ["red", "blue", "green", "yellow"];
  const counts = rng.sample(colors, level >= 3 ? 3 : 2).map((c) => ({ c, n: rng.int(2, 6 + level * 2) }));
  const total = counts.reduce((a, b) => a + b.n, 0);
  const target = rng.pick(counts);
  const frac: Frac = simplify({ n: target.n, d: total });
  return {
    instructions: "Write the probability as a fraction in simplest form.",
    stem: `A bag holds ${counts.map((c) => `${c.n} ${c.c}`).join(" and ")} marbles. You draw one without looking.\n\nWhat is P(**${target.c}**)?`,
    format: { kind: "fraction" },
    answer: fracStr(frac),
    accept: fracAccept({ n: target.n, d: total }),
    explanation: `There are ${target.n} ${target.c} marbles out of ${total} total, so P = ${target.n}/${total} = ${fracStr(frac)}.`,
    hint: "Favorable outcomes over total outcomes.",
  };
};

const wordProblemRate: GeneratorFn = (rng, level) => {
  const rate = rng.int(30, 40 + level * 15);
  const time = rng.int(2, 3 + level);
  const name = rng.pick(NAMES);
  const mode = rng.pick(["distance", "time"]);
  if (mode === "time") {
    return numeric({
      instructions: "Enter the number of hours.",
      stem: `${name} drives **${rate * time} miles** at **${rate} miles per hour**. How many hours does the trip take?`,
      answer: `${time}`,
      explanation: `t = d ÷ r = ${rate * time} ÷ ${rate} = ${time} hours.`,
      hint: "time = distance ÷ rate",
    });
  }
  return numeric({
    instructions: "Enter the number of miles.",
    stem: `${name} rides at **${rate} miles per hour** for **${time} hours**. How far does ${name} travel?`,
    answer: `${rate * time}`,
    explanation: `d = r × t = ${rate} × ${time} = ${rate * time} miles.`,
    hint: "distance = rate × time",
  });
};

/* ------------------------------------------------------------------ figures */

function rectFigure(w: number, h: number): string {
  const s = 14;
  const W = w * s, H = h * s;
  return `<svg viewBox="0 0 ${W + 70} ${H + 50}" role="img" aria-label="Rectangle ${w} by ${h}">
    <rect x="35" y="15" width="${W}" height="${H}" fill="var(--kx-fig-fill)" stroke="var(--kx-fig-stroke)" stroke-width="2" rx="2"/>
    <text x="${35 + W / 2}" y="${H + 38}" text-anchor="middle" class="kx-fig-label">${w} cm</text>
    <text x="20" y="${15 + H / 2}" text-anchor="middle" class="kx-fig-label" transform="rotate(-90 20 ${15 + H / 2})">${h} cm</text>
  </svg>`;
}

function triangleFigure(b: number, h: number): string {
  const s = 12;
  const W = b * s, H = h * s;
  return `<svg viewBox="0 0 ${W + 70} ${H + 50}" role="img" aria-label="Triangle base ${b} height ${h}">
    <polygon points="35,${15 + H} ${35 + W},${15 + H} ${35 + W / 2},15" fill="var(--kx-fig-fill)" stroke="var(--kx-fig-stroke)" stroke-width="2"/>
    <line x1="${35 + W / 2}" y1="15" x2="${35 + W / 2}" y2="${15 + H}" stroke="var(--kx-fig-stroke)" stroke-width="1.5" stroke-dasharray="4 3"/>
    <text x="${35 + W / 2}" y="${H + 38}" text-anchor="middle" class="kx-fig-label">${b} cm</text>
    <text x="${42 + W / 2}" y="${18 + H / 2}" class="kx-fig-label">${h} cm</text>
  </svg>`;
}

function rightTriangleFigure(a: number, other: number, findHyp: boolean): string {
  const s = 9;
  const W = Math.min(other * s, 200), H = Math.min(a * s, 160);
  return `<svg viewBox="0 0 ${W + 80} ${H + 50}" role="img" aria-label="Right triangle">
    <polygon points="35,${15 + H} ${35 + W},${15 + H} 35,15" fill="var(--kx-fig-fill)" stroke="var(--kx-fig-stroke)" stroke-width="2"/>
    <path d="M 35 ${15 + H - 12} h 12 v 12" fill="none" stroke="var(--kx-fig-stroke)" stroke-width="1.5"/>
    <text x="20" y="${15 + H / 2}" text-anchor="middle" class="kx-fig-label">${a}</text>
    <text x="${35 + W / 2}" y="${H + 38}" text-anchor="middle" class="kx-fig-label">${findHyp ? other : "?"}</text>
    <text x="${40 + W / 2}" y="${10 + H / 2}" class="kx-fig-label">${findHyp ? "?" : other}</text>
  </svg>`;
}

function circleFigure(r: number): string {
  const s = 10;
  const R = r * s;
  const c = R + 20;
  return `<svg viewBox="0 0 ${c * 2} ${c * 2}" role="img" aria-label="Circle with radius ${r}">
    <circle cx="${c}" cy="${c}" r="${R}" fill="var(--kx-fig-fill)" stroke="var(--kx-fig-stroke)" stroke-width="2"/>
    <line x1="${c}" y1="${c}" x2="${c + R}" y2="${c}" stroke="var(--kx-fig-stroke)" stroke-width="1.5"/>
    <circle cx="${c}" cy="${c}" r="2.5" fill="var(--kx-fig-stroke)"/>
    <text x="${c + R / 2}" y="${c - 8}" text-anchor="middle" class="kx-fig-label">${r} cm</text>
  </svg>`;
}

export const mathGenerators: Record<string, GeneratorFn> = {
  "count-objects": countObjects,
  "compare-numbers": compareNumbers,
  "add-within": addWithin,
  "sub-within": subWithin,
  "multi-digit-add": multiDigitAdd,
  "multi-digit-sub": multiDigitSub,
  "multiplication-facts": multiplicationFacts,
  "division-facts": divisionFacts,
  "multi-digit-multiply": multiDigitMultiply,
  "long-division": longDivision,
  "place-value": placeValue,
  rounding,
  "gcf-lcm": gcfLcm,
  "absolute-value": absoluteValue,
  "integer-ops": integerOps,
  "order-of-operations": orderOfOperations,
  exponents,
  "scientific-notation": scientificNotation,
  "fraction-compare": fractionCompare,
  "fraction-add": fractionAdd,
  "fraction-multiply": fractionMultiply,
  "fraction-of-number": fractionOfNumber,
  "decimal-ops": decimalOps,
  "decimal-fraction-percent": decimalFractionPercent,
  "percent-of-number": percentOfNumber,
  "percent-change": percentChange,
  "ratio-proportion": ratioProportion,
  "unit-rate": unitRate,
  "unit-conversion": unitConversion,
  "evaluate-expression": evaluateExpression,
  "one-step-equation": oneStepEquation,
  "two-step-equation": twoStepEquation,
  inequality,
  "slope-from-points": slopeFromPoints,
  "slope-intercept": slopeIntercept,
  "system-of-equations": systemOfEquations,
  "factor-quadratic": factorQuadratic,
  sequences,
  "function-table": functionTable,
  "area-perimeter": areaPerimeter,
  volume,
  pythagorean,
  angles,
  "coordinate-plane": coordinatePlane,
  "mean-median-mode": meanMedianMode,
  probability,
  "word-problem-rate": wordProblemRate,
};
