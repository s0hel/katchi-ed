import { describe, expect, it } from "vitest";
import { BANK_NAMES, BANKS, type BankName } from "../generators/banks";
import { ITEM_SCHEMA, dedupeKey, itemsOf, poolsOf } from "../generators/bank-schema";

/**
 * Guards the ELA content banks. These are the same rules the offline generator
 * script applies to a draft, so anything it writes has already passed here --
 * and anything a maintainer hand-edits has to pass too.
 */
describe("ELA content banks", () => {
  for (const bank of BANK_NAMES) {
    describe(bank, () => {
      const items = itemsOf(bank);

      it("is non-empty", () => {
        expect(items.length).toBeGreaterThan(0);
      });

      it("has well-formed items", () => {
        const schema = ITEM_SCHEMA[bank];
        const bad = items
          .map((item, i) => {
            const parsed = schema.safeParse(item);
            return parsed.success ? null : { i, issues: parsed.error.issues.map((e) => e.message) };
          })
          .filter(Boolean);
        expect(bad).toEqual([]);
      });

      it("has no duplicate items within a pool", () => {
        const key = dedupeKey[bank] as (item: unknown) => string;
        const dupes: string[] = [];
        for (const pool of poolsOf(bank)) {
          const seen = new Map<string, number>();
          pool.forEach((item, i) => {
            const k = key(item);
            if (seen.has(k)) dupes.push(`${k} (items ${seen.get(k)} and ${i})`);
            else seen.set(k, i);
          });
        }
        expect(dupes).toEqual([]);
      });
    });
  }

  it("keeps the levelled pools large enough to be worth splitting", () => {
    // Several generators show only the first N items below level 3. A bank
    // that is too small makes that split meaningless.
    const thin = BANK_NAMES.filter((b: BankName) => itemsOf(b).length < 4);
    expect(thin).toEqual([]);
  });

  it("gives synonyms and antonyms their own pools", () => {
    const syn = new Set(BANKS.wordPairs.synonyms.map((w) => w[0].toLowerCase()));
    const both = BANKS.wordPairs.antonyms.filter((w) => syn.has(w[0].toLowerCase()));
    // the same prompt word in both pools is fine; the same PAIR is not
    const synPairs = new Set(BANKS.wordPairs.synonyms.map((w) => `${w[0]}|${w[1]}`.toLowerCase()));
    expect(both.filter((w) => synPairs.has(`${w[0]}|${w[1]}`.toLowerCase()))).toEqual([]);
  });
});
