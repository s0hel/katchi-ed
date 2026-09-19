import { choice, text, type GeneratorFn } from "./helpers";
import { BANKS } from "./banks";

/* -------------------------------------------------------------- generators */

const synonymsAntonyms: GeneratorFn = (rng, level, params) => {
  const mode = params["mode"] === "antonym" ? "antonyms" : "synonyms";
  const bank = BANKS.wordPairs[mode];
  const pool = level >= 3 ? bank : bank.slice(0, Math.max(4, Math.ceil(bank.length * 0.7)));
  const [word, answer, distractors] = rng.pick(pool);
  return choice(rng, {
    instructions: `Choose the ${mode === "antonyms" ? "antonym" : "synonym"}.`,
    stem: `Which word means the ${mode === "antonyms" ? "**opposite** of" : "**same** as"} **${word}**?`,
    answer,
    distractors: [...distractors],
    explanation: `**${answer}** means the ${mode === "antonyms" ? "opposite of" : "same thing as"} **${word}**.`,
    hint: mode === "antonyms" ? "Look for the word that reverses the meaning." : "Try swapping each choice into a sentence with the original word.",
  });
};

const partsOfSpeech: GeneratorFn = (rng, level) => {
  const pool = level >= 3 ? BANKS.posSentences : BANKS.posSentences.filter((p) => ["noun", "verb", "adjective", "adverb"].includes(p.pos));
  const item = rng.pick(pool);
  return choice(rng, {
    instructions: "Identify the part of speech.",
    stem: `What part of speech is the **bold** word?\n\n${item.s}`,
    answer: item.pos,
    distractors: ["noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction"].filter((p) => p !== item.pos),
    explanation: `**${item.word}** is a ${item.pos} here${item.pos === "adjective" ? " — it describes a noun" : item.pos === "adverb" ? " — it describes how the action happens" : item.pos === "verb" ? " — it names the action" : ""}.`,
    hint: "Ask what job the word does in the sentence.",
  });
};

const homophones: GeneratorFn = (rng, level) => {
  const item = rng.pick(level >= 3 ? BANKS.homophones : BANKS.homophones.slice(0, 6));
  return choice(rng, {
    instructions: "Choose the word that completes the sentence.",
    stem: item.sentence.replace("___", "**___**"),
    answer: item.answer,
    distractors: item.options.filter((o) => o !== item.answer),
    explanation: item.why,
    hint: "Try reading the sentence aloud with each choice.",
  });
};

const subjectVerbAgreement: GeneratorFn = (rng, level) => {
  const items = BANKS.subjectVerbAgreement;
  const item = rng.pick(level >= 3 ? items : items.slice(0, 4));
  return choice(rng, {
    instructions: "Choose the verb that agrees with the subject.",
    stem: item.s.replace("___", "**___**"),
    answer: item.answer,
    distractors: item.wrong,
    explanation: item.why,
    hint: "Find the true subject, then ignore the words in between.",
  });
};

const punctuation: GeneratorFn = (rng, level) => {
  const items = BANKS.punctuation;
  const item = rng.pick(level >= 3 ? items : items.slice(0, 3));
  return choice(rng, {
    instructions: "Choose the correct punctuation for the blank.",
    stem: item.s.replace(/___/g, "**___**"),
    answer: item.answer,
    distractors: item.wrong,
    explanation: item.why,
    hint: "Decide whether each half could stand alone as a sentence.",
  });
};

const capitalization: GeneratorFn = (rng, level) => {
  const items = BANKS.capitalization;
  const item = rng.pick(level >= 3 ? items : items.slice(0, 3));
  return text({
    instructions: "Rewrite the sentence with correct capitalization.",
    stem: `${item.wrong}`,
    answer: item.right,
    placeholder: "Type the corrected sentence",
    explanation: `${item.right}\n\n${item.why}`,
    hint: "Check the first word, names, places, months, and days.",
  });
};

const sentenceType: GeneratorFn = (rng, level) => {
  const items = BANKS.sentenceType;
  const item = rng.pick(level >= 3 ? items : items.slice(0, 4));
  return choice(rng, {
    instructions: "Identify the sentence type.",
    stem: `_${item.s}_`,
    answer: item.answer,
    distractors: ["fragment", "run-on", "complete sentence"],
    explanation: item.why,
    hint: "Does it have a subject and a verb? Does it stop where it should?",
  });
};

const verbTense: GeneratorFn = (rng, level) => {
  const items = BANKS.verbTense;
  const item = rng.pick(level >= 3 ? items : items.slice(0, 2));
  return choice(rng, {
    instructions: "Choose the correct verb form.",
    stem: item.s.replace("___", "**___**"),
    answer: item.answer,
    distractors: item.wrong,
    explanation: item.why,
    hint: "Look for time clues in the sentence.",
  });
};

const prefixSuffix: GeneratorFn = (rng, level) => {
  const item = rng.pick(level >= 3 ? BANKS.affixes : BANKS.affixes.slice(0, 6));
  return choice(rng, {
    instructions: "Choose the meaning of the word part.",
    stem: `What does **${item.affix}** mean, as in _${item.example}_?`,
    answer: item.meaning,
    distractors: item.distractors,
    explanation: `**${item.affix}** means "${item.meaning}", so _${item.example}_ builds on that meaning.`,
    hint: "Think about other words that use the same word part.",
  });
};

const contextClues: GeneratorFn = (rng, level) => {
  const p = rng.pick(BANKS.passages);

  if (level >= 4) {
    // Naming the clue is a step beyond knowing the meaning.
    return choice(rng, {
      instructions: "Find the context clue.",
      stem: `${p.text}

Which part of the passage best helps you work out what **${p.vocabHard.word}** means?`,
      answer: p.clue.answer,
      distractors: [...p.clue.wrong],
      explanation: `That phrase is what signals the meaning of **${p.vocabHard.word}**: ${p.vocabHard.meaning}.`,
      hint: "Look for the words around it that hint at the meaning.",
    });
  }

  const target = level >= 3 ? p.vocabHard : p.vocab;
  return choice(rng, {
    instructions: "Use the passage to determine the meaning.",
    stem: `${p.text}

In this passage, **${target.word}** most nearly means:`,
    answer: target.meaning,
    distractors: [...target.distractors],
    explanation: `The surrounding sentences show that **${target.word}** means "${target.meaning}".`,
    hint: "Reread the sentence before and after the word.",
  });
};

const mainIdea: GeneratorFn = (rng, level) => {
  const p = rng.pick(BANKS.passages);

  if (level === 2) {
    return choice(rng, {
      instructions: "Find the supporting detail.",
      stem: `${p.text}

${p.detail.question}`,
      answer: p.detail.answer,
      distractors: [...p.detail.wrong],
      explanation: `The main idea is that ${lowerFirst(p.mainIdea)} That detail is the one that backs it up directly.`,
      hint: "A supporting detail gives evidence for the main point, not just any fact.",
    });
  }

  if (level === 3) {
    return choice(rng, {
      instructions: "Identify the author's purpose.",
      stem: `${p.text}

Why did the author most likely write this passage?`,
      answer: p.purpose.answer,
      distractors: [...p.purpose.wrong],
      explanation: `The passage works toward one point: ${lowerFirst(p.mainIdea)} That is the author's purpose.`,
      hint: "Ask what the whole passage is trying to get you to understand.",
    });
  }

  if (level >= 4) {
    return choice(rng, {
      instructions: "Draw a conclusion from the passage.",
      stem: `${p.text}

Which conclusion does the passage best support?`,
      answer: p.inference.answer,
      distractors: [...p.inference.wrong],
      explanation: `The passage never states this outright, but it follows from what it does say. The other options go further than the passage supports.`,
      hint: "Pick the statement the passage supports, not one it merely hints at.",
    });
  }

  return choice(rng, {
    instructions: "Identify the main idea.",
    stem: `${p.text}

What is the **main idea** of this passage?`,
    answer: p.mainIdea,
    distractors: [...p.wrong],
    explanation: `The other options are single details or claims the passage never makes. The main idea covers the whole passage: ${p.mainIdea}`,
    hint: "The main idea covers the whole passage, not one detail.",
  });
};

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

const figurativeLanguage: GeneratorFn = (rng, level) => {
  const items = BANKS.figurativeLanguage;
  const item = rng.pick(level >= 3 ? items : items.slice(0, 5));
  return choice(rng, {
    instructions: "Identify the figure of speech.",
    stem: `_"${item.s}"_`,
    answer: item.answer,
    distractors: ["simile", "metaphor", "personification", "hyperbole", "alliteration"].filter((x) => x !== item.answer),
    explanation: item.why,
    hint: "Check for \"like\" or \"as\" first.",
  });
};

const analogies: GeneratorFn = (rng, level) => {
  const items = BANKS.analogies;
  const item = rng.pick(level >= 3 ? items : items.slice(0, 4));
  return choice(rng, {
    instructions: "Complete the analogy.",
    stem: `**${item.a} : ${item.b} :: ${item.c} : ___**`,
    answer: item.answer,
    distractors: item.wrong,
    explanation: item.why,
    hint: "Say the relationship out loud as a sentence.",
  });
};

const plurals: GeneratorFn = (rng, level) => {
  const items = BANKS.plurals;
  const item = rng.pick(level >= 3 ? items : items.slice(0, 5));
  return choice(rng, {
    instructions: "Choose the correct plural.",
    stem: `What is the plural of **${item.sing}**?`,
    answer: item.answer,
    distractors: item.wrong,
    explanation: `The plural of **${item.sing}** is **${item.answer}**.`,
    hint: "Irregular plurals don't always just add -s.",
  });
};

const pronounAntecedent: GeneratorFn = (rng, level) => {
  const items = BANKS.pronounAntecedent;
  const item = rng.pick(level >= 3 ? items : items.slice(0, 2));
  return choice(rng, {
    instructions: "Choose the pronoun that matches its antecedent.",
    stem: item.s.replace("___", "**___**"),
    answer: item.answer,
    distractors: item.wrong,
    explanation: item.why,
    hint: "Find the noun the pronoun replaces, then match number.",
  });
};

export const elaGenerators: Record<string, GeneratorFn> = {
  "synonyms-antonyms": synonymsAntonyms,
  "parts-of-speech": partsOfSpeech,
  homophones,
  "subject-verb-agreement": subjectVerbAgreement,
  punctuation,
  capitalization,
  "sentence-type": sentenceType,
  "verb-tense": verbTense,
  "prefix-suffix": prefixSuffix,
  "context-clues": contextClues,
  "main-idea": mainIdea,
  "figurative-language": figurativeLanguage,
  analogies,
  plurals,
  "pronoun-antecedent": pronounAntecedent,
};
