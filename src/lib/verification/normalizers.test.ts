import { describe, it, expect } from "vitest";
import { normalizeAbv, compareAbv, normalizeVolume, compareNetContents } from "./normalizers";

describe("normalizeAbv", () => {
  it("extracts ABV from standard format", () => {
    expect(normalizeAbv("45% Alc./Vol. (90 Proof)")).toBe(45);
  });

  it("extracts ABV from simple percentage", () => {
    expect(normalizeAbv("45%")).toBe(45);
  });

  it("handles decimal ABV", () => {
    expect(normalizeAbv("13.5% Alc./Vol.")).toBe(13.5);
  });

  it("fixes OCR artifact: 135% becomes 13.5%", () => {
    expect(normalizeAbv("135%")).toBe(13.5);
  });

  it("returns null for non-numeric", () => {
    expect(normalizeAbv("not a number")).toBeNull();
  });
});

describe("compareAbv", () => {
  it("matches equal ABV values", () => {
    const result = compareAbv("45% Alc./Vol. (90 Proof)", "45%");
    expect(result.match).toBe(true);
  });

  it("catches ABV mismatch", () => {
    const result = compareAbv("40% Alc./Vol. (80 Proof)", "45%");
    expect(result.match).toBe(false);
    expect(result.details).toContain("40%");
    expect(result.details).toContain("45%");
  });

  it("handles null extracted", () => {
    const result = compareAbv(null, "45%");
    expect(result.match).toBe(false);
  });
});

describe("normalizeVolume", () => {
  it("parses mL", () => {
    const vol = normalizeVolume("750 mL");
    expect(vol?.value).toBe(750);
    expect(vol?.unit).toBe("ml");
  });

  it("parses L", () => {
    const vol = normalizeVolume("1.75 L");
    expect(vol?.value).toBe(1.75);
    expect(vol?.unit).toBe("l");
  });

  it("parses no-space format", () => {
    const vol = normalizeVolume("750mL");
    expect(vol?.value).toBe(750);
  });
});

describe("compareNetContents", () => {
  it("matches equal volumes", () => {
    const result = compareNetContents("750 mL", "750 mL");
    expect(result.match).toBe(true);
  });

  it("catches volume mismatch", () => {
    const result = compareNetContents("750 mL", "1 L");
    expect(result.match).toBe(false);
  });
});
