import { describe, it, expect } from "vitest";
import { fuzzyCompare, normalizeText } from "./fuzzyMatch";

describe("normalizeText", () => {
  it("lowercases text", () => {
    expect(normalizeText("OLD TOM DISTILLERY")).toBe("old tom distillery");
  });

  it("strips apostrophes", () => {
    expect(normalizeText("STONE'S THROW")).toBe("stones throw");
  });

  it("converts hyphens to spaces", () => {
    expect(normalizeText("barrel-aged")).toBe("barrel aged");
  });

  it("removes punctuation", () => {
    expect(normalizeText("Hello, World!")).toBe("hello world");
  });

  it("collapses whitespace", () => {
    expect(normalizeText("  too   many   spaces  ")).toBe("too many spaces");
  });
});

describe("fuzzyCompare", () => {
  it("matches identical strings", () => {
    const result = fuzzyCompare("OLD TOM DISTILLERY", "OLD TOM DISTILLERY");
    expect(result.match).toBe(true);
    expect(result.confidence).toBe(1);
  });

  it("matches case-insensitive (Dave's scenario)", () => {
    const result = fuzzyCompare("STONE'S THROW", "Stone's Throw");
    expect(result.match).toBe(true);
    expect(result.confidence).toBe(1);
    expect(result.details).toContain("Exact match after normalization");
  });

  it("catches genuine mismatches", () => {
    const result = fuzzyCompare("OLD TOM DISTILLERY", "HARBOR LIGHT SPIRITS");
    expect(result.match).toBe(false);
  });

  it("handles empty extracted value", () => {
    const result = fuzzyCompare("", "Expected Brand");
    expect(result.match).toBe(false);
    expect(result.details).toContain("missing");
  });

  it("handles both empty", () => {
    const result = fuzzyCompare("", "");
    expect(result.match).toBe(true);
  });
});
