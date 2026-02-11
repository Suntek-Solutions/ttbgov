import { describe, it, expect } from "vitest";
import { validateWarning } from "./warningValidator";
import { STANDARD_WARNING_TEXT } from "@/lib/extraction/patterns";

describe("validateWarning", () => {
  it("validates correct government warning", () => {
    const result = validateWarning(STANDARD_WARNING_TEXT);
    expect(result.match).toBe(true);
    expect(result.checks.present).toBe(true);
    expect(result.checks.prefixAllCaps).toBe(true);
    expect(result.checks.hasSentence1).toBe(true);
    expect(result.checks.hasSentence2).toBe(true);
  });

  it("rejects title case prefix (Jenny's scenario)", () => {
    const titleCase = STANDARD_WARNING_TEXT.replace(
      "GOVERNMENT WARNING:",
      "Government Warning:"
    );
    const result = validateWarning(titleCase);
    expect(result.match).toBe(false);
    expect(result.checks.prefixAllCaps).toBe(false);
    expect(result.details).toContain("not in all caps");
  });

  it("rejects missing warning", () => {
    const result = validateWarning(null);
    expect(result.match).toBe(false);
    expect(result.checks.present).toBe(false);
  });

  it("rejects empty warning", () => {
    const result = validateWarning("");
    expect(result.match).toBe(false);
    expect(result.checks.present).toBe(false);
  });

  it("rejects warning missing sentence 1", () => {
    const partial =
      "GOVERNMENT WARNING: (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";
    const result = validateWarning(partial);
    expect(result.match).toBe(false);
    expect(result.checks.hasSentence1).toBe(false);
  });

  it("rejects warning missing sentence 2", () => {
    const partial =
      "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects.";
    const result = validateWarning(partial);
    expect(result.match).toBe(false);
    expect(result.checks.hasSentence2).toBe(false);
  });
});
