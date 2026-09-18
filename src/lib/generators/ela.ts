import { choice, text, type GeneratorFn } from "./helpers";

/* --------------------------------------------------------------- word banks */

type WordItem = [word: string, answer: string, distractors: string[]];

const WORD_PAIRS: Record<"synonyms" | "antonyms", WordItem[]> = {
  synonyms: [
    ["happy", "joyful", ["angry", "tired", "quiet"]],
    ["big", "enormous", ["tiny", "narrow", "brief"]],
    ["fast", "rapid", ["slow", "heavy", "dull"]],
    ["begin", "start", ["finish", "forget", "lose"]],
    ["brave", "courageous", ["fearful", "clumsy", "polite"]],
    ["difficult", "challenging", ["simple", "pleasant", "empty"]],
    ["calm", "peaceful", ["frantic", "loud", "sharp"]],
    ["ancient", "old", ["modern", "clean", "bright"]],
    ["accurate", "precise", ["careless", "vague", "rushed"]],
    ["reluctant", "unwilling", ["eager", "cheerful", "honest"]],
    ["abundant", "plentiful", ["scarce", "fragile", "sturdy"]],
    ["observe", "watch", ["ignore", "shout", "build"]],
  ],
  antonyms: [
    ["generous", "stingy", ["kind", "wealthy", "cheerful"]],
    ["expand", "shrink", ["stretch", "widen", "grow"]],
    ["ancient", "modern", ["historic", "dusty", "wise"]],
    ["praise", "criticize", ["admire", "applaud", "notice"]],
    ["temporary", "permanent", ["brief", "fleeting", "short"]],
    ["confident", "insecure", ["certain", "bold", "proud"]],
    ["scatter", "gather", ["spread", "toss", "drop"]],
    ["transparent", "opaque", ["clear", "glassy", "thin"]],
    ["arrive", "depart", ["reach", "enter", "land"]],
    ["humble", "arrogant", ["modest", "quiet", "gentle"]],
  ],
};

const HOMOPHONES = [
  { sentence: "The dog wagged ___ tail happily.", answer: "its", options: ["its", "it's", "its'"], why: "\"Its\" shows possession; \"it's\" is short for \"it is\"." },
  { sentence: "___ going to be late for the bus.", answer: "They're", options: ["They're", "Their", "There"], why: "\"They're\" is short for \"they are\"." },
  { sentence: "Please put the books over ___.", answer: "there", options: ["there", "their", "they're"], why: "\"There\" refers to a place." },
  { sentence: "I have more crayons than ___ do.", answer: "you", options: ["you", "your", "you're"], why: "The subject of \"do\" is the pronoun \"you\"." },
  { sentence: "The wind blew ___ hard to fly a kite.", answer: "too", options: ["too", "to", "two"], why: "\"Too\" means excessively." },
  { sentence: "We walked ___ the park after lunch.", answer: "through", options: ["through", "threw", "thorough"], why: "\"Through\" means from one side to the other." },
  { sentence: "She wasn't sure ___ path to take.", answer: "which", options: ["which", "witch", "wich"], why: "\"Which\" asks about a choice; a \"witch\" is a person." },
  { sentence: "The recipe calls for flour, sugar, ___ eggs.", answer: "and", options: ["and", "an", "add"], why: "\"And\" joins items in a list." },
  { sentence: "He ate a ___ piece of pie.", answer: "whole", options: ["whole", "hole", "howl"], why: "\"Whole\" means complete; a \"hole\" is an opening." },
  { sentence: "They will ___ the letter tomorrow.", answer: "accept", options: ["accept", "except", "expect"], why: "\"Accept\" means to receive; \"except\" means excluding." },
];

const POS_SENTENCES = [
  { s: "The **curious** fox darted across the snowy field.", word: "curious", pos: "adjective" },
  { s: "The fox **darted** across the snowy field.", word: "darted", pos: "verb" },
  { s: "The curious **fox** darted across the field.", word: "fox", pos: "noun" },
  { s: "She sang **beautifully** during the concert.", word: "beautifully", pos: "adverb" },
  { s: "**They** finished the project before dinner.", word: "They", pos: "pronoun" },
  { s: "The cat slept **under** the warm blanket.", word: "under", pos: "preposition" },
  { s: "I wanted to go, **but** it started raining.", word: "but", pos: "conjunction" },
  { s: "The **enormous** whale surfaced near the boat.", word: "enormous", pos: "adjective" },
  { s: "Marco **builds** model rockets every weekend.", word: "builds", pos: "verb" },
  { s: "The team practiced **quietly** in the gym.", word: "quietly", pos: "adverb" },
  { s: "**Happiness** filled the room after the news.", word: "Happiness", pos: "noun" },
  { s: "We waited **until** the rain stopped.", word: "until", pos: "conjunction" },
];

const AFFIXES = [
  { affix: "un-", meaning: "not", example: "unhappy", distractors: ["again", "before", "full of"] },
  { affix: "re-", meaning: "again", example: "rewrite", distractors: ["not", "under", "without"] },
  { affix: "pre-", meaning: "before", example: "preview", distractors: ["after", "not", "many"] },
  { affix: "-less", meaning: "without", example: "fearless", distractors: ["full of", "again", "able to"] },
  { affix: "-ful", meaning: "full of", example: "joyful", distractors: ["without", "not", "before"] },
  { affix: "mis-", meaning: "wrongly", example: "misread", distractors: ["again", "very", "under"] },
  { affix: "-able", meaning: "able to be", example: "readable", distractors: ["without", "before", "one who"] },
  { affix: "sub-", meaning: "under", example: "submarine", distractors: ["over", "around", "not"] },
  { affix: "-er", meaning: "one who", example: "teacher", distractors: ["not", "full of", "before"] },
  { affix: "inter-", meaning: "between", example: "international", distractors: ["inside", "after", "against"] },
];

const PASSAGES = [
  {
    text: "Honeybees do more than make honey. As they move from flower to flower collecting nectar, pollen sticks to their fuzzy bodies and rubs off on the next blossom. That accidental delivery service pollinates roughly one out of every three bites of food people eat. When bee populations fall, farmers notice it in their harvests long before shoppers notice it in stores.",
    mainIdea: "Honeybees are important to food supplies because they pollinate crops.",
    wrong: [
      "Honeybees make honey by collecting nectar from flowers.",
      "Farmers should keep beehives near their fields.",
      "Bees have fuzzy bodies that carry pollen.",
    ],
    vocab: { word: "pollinates", meaning: "carries pollen between flowers", distractors: ["removes insects from", "waters the roots of", "protects the petals of"] },
  },
  {
    text: "For centuries, sailors navigated by the stars. A skilled navigator could fix a ship's position using only a sextant, a clock, and a clear night sky. Satellite navigation made that work almost effortless, but many naval academies still teach celestial navigation. Instruments fail, batteries die, and signals can be jammed — the stars cannot be switched off.",
    mainIdea: "Celestial navigation is still taught because it works when technology fails.",
    wrong: [
      "Sextants and clocks were the only tools sailors owned.",
      "Satellite navigation is more accurate than reading the stars.",
      "Naval academies require students to study astronomy.",
    ],
    vocab: { word: "jammed", meaning: "blocked or disrupted", distractors: ["packed tightly", "repaired quickly", "sold cheaply"] },
  },
  {
    text: "The Sonoran Desert looks empty at midday, but that is a trick of timing. Most of its animals are crepuscular, active in the cool half-light of dawn and dusk. Kangaroo rats spend the blazing hours in burrows, and cactus wrens tuck into shaded nests. A visitor who arrives at noon and leaves at two will swear nothing lives there.",
    mainIdea: "Desert animals are active at dawn and dusk, so the desert only seems lifeless.",
    wrong: [
      "Kangaroo rats dig burrows to escape predators.",
      "The Sonoran Desert has very few animal species.",
      "Visitors should tour the desert in the early morning.",
    ],
    vocab: { word: "crepuscular", meaning: "active at dawn and dusk", distractors: ["living underground", "able to survive without water", "hunting in large groups"] },
  },
  {
    text: "Rosa Parks is often described as a tired seamstress who simply would not stand up. She was in fact a trained organizer who had served as secretary of her local NAACP chapter for over a decade. Her refusal on that Montgomery bus was a deliberate act by someone who understood exactly what it would set in motion.",
    mainIdea: "Rosa Parks's refusal was a deliberate act by an experienced organizer, not a spontaneous one.",
    wrong: [
      "Rosa Parks worked as a seamstress in Montgomery.",
      "The NAACP organized the Montgomery bus boycott.",
      "Bus segregation laws were common in the American South.",
    ],
    vocab: { word: "deliberate", meaning: "done on purpose", distractors: ["done in anger", "done by accident", "done in secret"] },
  },
];

/* -------------------------------------------------------------- generators */

const synonymsAntonyms: GeneratorFn = (rng, level, params) => {
  const mode = params["mode"] === "antonym" ? "antonyms" : "synonyms";
  const bank = WORD_PAIRS[mode];
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
  const pool = level >= 3 ? POS_SENTENCES : POS_SENTENCES.filter((p) => ["noun", "verb", "adjective", "adverb"].includes(p.pos));
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
  const item = rng.pick(level >= 3 ? HOMOPHONES : HOMOPHONES.slice(0, 6));
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
  const items = [
    { s: "The box of markers ___ on the shelf.", answer: "sits", wrong: ["sit", "are sitting", "have sat"], why: "The subject is \"box\" (singular), not \"markers\"." },
    { s: "Neither of the dogs ___ barking.", answer: "is", wrong: ["are", "were", "be"], why: "\"Neither\" is singular, so it takes \"is\"." },
    { s: "My friends ___ to the movies every Friday.", answer: "go", wrong: ["goes", "is going", "has gone"], why: "\"Friends\" is plural, so the verb takes no -s." },
    { s: "Each of the players ___ a locker.", answer: "has", wrong: ["have", "are having", "having"], why: "\"Each\" is always singular." },
    { s: "The team ___ practicing in the gym.", answer: "is", wrong: ["are", "were", "be"], why: "\"Team\" is a collective noun acting as one unit." },
    { s: "There ___ several reasons to be careful.", answer: "are", wrong: ["is", "was", "be"], why: "The real subject, \"reasons,\" is plural." },
  ];
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
  const items = [
    { s: "After the storm passed ___ we walked down to the beach.", answer: ",", wrong: [";", ":", "no punctuation"], why: "A comma follows an introductory clause." },
    { s: "We packed sandwiches ___ apples, and water.", answer: ",", wrong: [";", ":", "no punctuation"], why: "Commas separate items in a series." },
    { s: "Bring these items ___ a tent, a lantern, and rope.", answer: ":", wrong: [",", ";", "no punctuation"], why: "A colon introduces a list after a complete sentence." },
    { s: "The game was canceled ___ the field was flooded.", answer: ";", wrong: [",", ":", "no punctuation"], why: "A semicolon joins two closely related independent clauses." },
    { s: "My brother ___ who lives in Austin ___ is visiting in June.", answer: ", ,", wrong: ["; ;", ": :", "no punctuation"], why: "Commas set off a nonessential clause." },
  ];
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
  const items = [
    { wrong: "we visited paris last summer.", right: "We visited Paris last summer.", why: "Sentences start with a capital, and \"Paris\" is a proper noun." },
    { wrong: "my birthday is in january.", right: "My birthday is in January.", why: "Months are capitalized." },
    { wrong: "dr. patel teaches biology at north high school.", right: "Dr. Patel teaches biology at North High School.", why: "Titles, names, and school names are proper nouns; subjects like biology are not." },
    { wrong: "the mississippi river runs south.", right: "The Mississippi River runs south.", why: "Names of specific places are capitalized; directions are not." },
    { wrong: "she reads the new york times on mondays.", right: "She reads The New York Times on Mondays.", why: "Titles of publications and days of the week are capitalized." },
  ];
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
  const items = [
    { s: "Running through the empty parking lot.", answer: "fragment", why: "There is no subject performing the action — it cannot stand alone." },
    { s: "The bell rang and everyone left the classroom quickly.", answer: "complete sentence", why: "It has a subject and a verb and expresses a full thought." },
    { s: "I finished my homework I went outside to play.", answer: "run-on", why: "Two complete sentences are joined with no punctuation or conjunction." },
    { s: "Because the road was closed for repairs.", answer: "fragment", why: "A subordinate clause on its own is a fragment." },
    { s: "She studied all week, and she passed the exam.", answer: "complete sentence", why: "Two clauses are joined correctly with a comma and \"and\"." },
    { s: "The rain stopped the sun came out the birds returned.", answer: "run-on", why: "Three sentences are strung together without punctuation." },
  ];
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
  const items = [
    { s: "Yesterday we ___ to the museum.", answer: "went", wrong: ["go", "will go", "going"], why: "\"Yesterday\" signals past tense." },
    { s: "By next spring, she ___ here for two years.", answer: "will have worked", wrong: ["works", "worked", "is working"], why: "Future perfect describes an action completed before a future time." },
    { s: "He ___ his bike when the rain started.", answer: "was riding", wrong: ["rides", "will ride", "has ridden"], why: "Past progressive shows an action in progress when something interrupted it." },
    { s: "They ___ in that house since 2019.", answer: "have lived", wrong: ["live", "lived", "will live"], why: "\"Since\" with a continuing action calls for present perfect." },
  ];
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
  const item = rng.pick(level >= 3 ? AFFIXES : AFFIXES.slice(0, 6));
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
  const p = rng.pick(PASSAGES);
  void level;
  return choice(rng, {
    instructions: "Use the passage to determine the meaning.",
    stem: `${p.text}\n\nIn this passage, **${p.vocab.word}** most nearly means:`,
    answer: p.vocab.meaning,
    distractors: [...p.vocab.distractors],
    explanation: `The surrounding sentences show that **${p.vocab.word}** means "${p.vocab.meaning}".`,
    hint: "Reread the sentence before and after the word.",
  });
};

const mainIdea: GeneratorFn = (rng, level) => {
  const p = rng.pick(PASSAGES);
  void level;
  return choice(rng, {
    instructions: "Identify the main idea.",
    stem: `${p.text}\n\nWhat is the **main idea** of this passage?`,
    answer: p.mainIdea,
    distractors: [...p.wrong],
    explanation: `The other options are details from the passage or ideas it never claims. The main idea covers the whole passage: ${p.mainIdea}`,
    hint: "The main idea covers the whole passage, not one detail.",
  });
};

const figurativeLanguage: GeneratorFn = (rng, level) => {
  const items = [
    { s: "The city was a furnace that afternoon.", answer: "metaphor", why: "It states one thing *is* another without using \"like\" or \"as\"." },
    { s: "Her laugh sounded like wind chimes.", answer: "simile", why: "It compares using \"like\"." },
    { s: "The old floorboards groaned under our feet.", answer: "personification", why: "A human action is given to an object." },
    { s: "I've told you a million times to close the door.", answer: "hyperbole", why: "It is a deliberate exaggeration." },
    { s: "The bees buzzed in the blooming basil.", answer: "alliteration", why: "Repeated beginning consonant sounds." },
    { s: "Time is a thief.", answer: "metaphor", why: "Time is directly called a thief." },
    { s: "He was as quiet as a shadow.", answer: "simile", why: "It compares using \"as\"." },
    { s: "The thunder grumbled all night.", answer: "personification", why: "Thunder is given a human behavior." },
  ];
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
  const items = [
    { a: "puppy", b: "dog", c: "kitten", answer: "cat", wrong: ["mouse", "paw", "fur"], why: "A puppy is a young dog; a kitten is a young cat." },
    { a: "author", b: "book", c: "composer", answer: "symphony", wrong: ["orchestra", "piano", "concert"], why: "A creator paired with what they create." },
    { a: "hot", b: "cold", c: "generous", answer: "stingy", wrong: ["kind", "rich", "helpful"], why: "The pairs are opposites." },
    { a: "shoe", b: "foot", c: "glove", answer: "hand", wrong: ["finger", "winter", "leather"], why: "An item paired with the body part it covers." },
    { a: "library", b: "books", c: "gallery", answer: "paintings", wrong: ["artists", "walls", "tickets"], why: "A place paired with what it holds." },
    { a: "seconds", b: "minute", c: "days", answer: "week", wrong: ["hour", "calendar", "year"], why: "Sixty seconds make a minute; seven days make a week." },
  ];
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
  const items = [
    { sing: "child", answer: "children", wrong: ["childs", "childes", "childrens"] },
    { sing: "leaf", answer: "leaves", wrong: ["leafs", "leafes", "leave"] },
    { sing: "mouse", answer: "mice", wrong: ["mouses", "mices", "meese"] },
    { sing: "box", answer: "boxes", wrong: ["boxs", "boxen", "boxies"] },
    { sing: "city", answer: "cities", wrong: ["citys", "cityes", "citties"] },
    { sing: "cactus", answer: "cacti", wrong: ["cactuses", "cactus", "cactae"] },
    { sing: "analysis", answer: "analyses", wrong: ["analysises", "analysis", "analysi"] },
    { sing: "hero", answer: "heroes", wrong: ["heros", "heroies", "heroses"] },
  ];
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
  const items = [
    { s: "Every student must bring ___ own lunch.", answer: "their", wrong: ["they", "them", "theirs"], why: "\"Their\" is the possessive form matching \"every student\" in modern usage." },
    { s: "The committee announced ___ decision on Friday.", answer: "its", wrong: ["it's", "their", "they're"], why: "\"Committee\" is singular here, so it takes \"its\"." },
    { s: "Maya and I packed ___ bags the night before.", answer: "our", wrong: ["their", "her", "ours"], why: "\"Maya and I\" is first-person plural, so the possessive is \"our\"." },
    { s: "Neither of the boys remembered ___ jacket.", answer: "his", wrong: ["their", "they're", "them"], why: "\"Neither\" is singular, matching a singular possessive." },
  ];
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
