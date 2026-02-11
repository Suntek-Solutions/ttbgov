import { describe, it, expect } from "vitest";
import { extractFields } from "./fieldExtractor";

// Simulated OCR output from compliant-label.png
const COMPLIANT_OCR = `Kentucky Straight Bourbon Whiskey

; 45% Alc./Vol. (90 Proof)
i 750 mL

GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic

beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages

impairs your ability to drive a car or operate machinery, and may cause health problems.

Distilled and Bottled by Old Tom Distillery, Louisville, KY
Product of USA`;

// Simulated OCR output from missing-warning.png
const NO_WARNING_OCR = `HARBOR LIGHT
London Dry Gin
47% Alc./Vol. (94 Proof)
750 mL
Distilled by Harbor Light Spirits, Seattle, WA
Product of USA`;

describe("extractFields", () => {
  it("extracts class/type from compliant label", () => {
    const fields = extractFields(COMPLIANT_OCR, 93);
    expect(fields.classType.value).toBe("Kentucky Straight Bourbon Whiskey");
  });

  it("extracts ABV from compliant label", () => {
    const fields = extractFields(COMPLIANT_OCR, 93);
    expect(fields.alcoholContent.value).toContain("45%");
  });

  it("extracts net contents from compliant label", () => {
    const fields = extractFields(COMPLIANT_OCR, 93);
    expect(fields.netContents.value).toContain("750");
  });

  it("extracts government warning from compliant label", () => {
    const fields = extractFields(COMPLIANT_OCR, 93);
    expect(fields.governmentWarning.value).toContain("GOVERNMENT WARNING:");
    expect(fields.governmentWarning.value).toContain("health problems");
  });

  it("extracts producer info from compliant label", () => {
    const fields = extractFields(COMPLIANT_OCR, 93);
    expect(fields.producerInfo.value).toContain("Old Tom Distillery");
  });

  it("extracts country of origin from compliant label", () => {
    const fields = extractFields(COMPLIANT_OCR, 93);
    expect(fields.countryOfOrigin.value).toContain("USA");
  });

  it("detects missing government warning", () => {
    const fields = extractFields(NO_WARNING_OCR, 92);
    expect(fields.governmentWarning.value).toBeNull();
  });

  it("extracts brand name from clean label", () => {
    const fields = extractFields(NO_WARNING_OCR, 92);
    expect(fields.brandName.value).toBe("HARBOR LIGHT");
  });

  it("extracts class/type from gin label", () => {
    const fields = extractFields(NO_WARNING_OCR, 92);
    expect(fields.classType.value).toBe("London Dry Gin");
  });

  it("preserves raw text", () => {
    const fields = extractFields(COMPLIANT_OCR, 93);
    expect(fields.rawText).toBe(COMPLIANT_OCR);
  });
});
