import { describe, expect, it } from "vitest";
import { reviewDraft } from "../generators/bank-schema";
import { BANKS } from "../generators/banks";

/**
 * The gate the offline generator runs every drafted item through. These cases
 * are the failure modes a model actually produces -- a distractor that is also
 * correct, a quote that isn't really in the passage, a near-duplicate of
 * something already in the bank.
 */
describe("reviewDraft", () => {
  const goodPlural = { sing: "goose", answer: "geese", wrong: ["gooses", "geeses", "goosen"] };

  it("keeps a well-formed item", () => {
    const { kept, rejected } = reviewDraft("plurals", [goodPlural]);
    expect(rejected).toEqual([]);
    expect(kept).toEqual([goodPlural]);
  });

  it("rejects an item whose distractor repeats the answer", () => {
    const { kept, rejected } = reviewDraft("plurals", [
      { sing: "goose", answer: "geese", wrong: ["gooses", "geese", "goosen"] },
    ]);
    expect(kept).toEqual([]);
    expect(rejected[0].why).toMatch(/differ/);
  });

  it("rejects a duplicate of an item already in the bank", () => {
    const existing = BANKS.plurals[0];
    const { kept, rejected } = reviewDraft("plurals", [{ ...existing }]);
    expect(kept).toEqual([]);
    expect(rejected[0].why).toBe("duplicate");
  });

  it("rejects a duplicate within the same batch", () => {
    const { kept, rejected } = reviewDraft("plurals", [goodPlural, { ...goodPlural }]);
    expect(kept).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].why).toBe("duplicate");
  });

  it("rejects a passage whose context clue is not really in the text", () => {
    const passage = {
      ...BANKS.passages[0],
      mainIdea: "A distinct main idea so this is not caught as a duplicate.",
      clue: { answer: "a sentence that never appears in the passage", wrong: ["a", "b"] },
    };
    const { kept, rejected } = reviewDraft("passages", [passage]);
    expect(kept).toEqual([]);
    expect(rejected[0].why).toMatch(/verbatim span/);
  });

  it("rejects a part-of-speech item that does not bold its target word", () => {
    const { kept, rejected } = reviewDraft("posSentences", [
      { s: "The tired runner stopped.", word: "tired", pos: "adjective" },
    ]);
    expect(kept).toEqual([]);
    expect(rejected[0].why).toMatch(/bold/);
  });

  it("rejects a homophone item whose options omit the answer", () => {
    const { kept, rejected } = reviewDraft("homophones", [
      { sentence: "We went ___ the store.", answer: "to", options: ["too", "two", "tow"], why: "..." },
    ]);
    expect(kept).toEqual([]);
    expect(rejected[0].why).toMatch(/contain the answer/);
  });

  it("does not throw on a malformed item that has no identifying field", () => {
    const { kept, rejected } = reviewDraft("plurals", [null]);
    expect(kept).toEqual([]);
    expect(rejected).toHaveLength(1);
  });

  it("accepts an explicit prior-key set so a dry run can be judged in isolation", () => {
    const { kept } = reviewDraft("plurals", [{ ...BANKS.plurals[0] }], new Set<string>());
    expect(kept).toHaveLength(1);
  });
});
