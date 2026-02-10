/**
 * Field Value Normalizers
 *
 * Extract and normalize numeric values from ABV and net contents fields
 * so comparison works regardless of formatting differences:
 *   "45% Alc./Vol. (90 Proof)" vs "45%" → both normalize to 45
 *   "750 mL" vs "750mL" → both normalize to { value: 750, unit: "ml" }
 */

// ---------------------------------------------------------------------------
// ABV Normalization
// ---------------------------------------------------------------------------

/**
 * Extract the numeric ABV percentage from a string.
 *
 * @param text - ABV string like "45% Alc./Vol. (90 Proof)" or "45%" or "45"
 * @returns Numeric ABV value, or null if not found
 */
export function normalizeAbv(text: string): number | null {
  if (!text) return null;

  // Match a number followed by % (with possible decimal)
  const match = text.match(/(\d{1,3}\.?\d*)\s*%/);
  if (match) {
    let val = parseFloat(match[1]);
    // Handle OCR artifact: "135%" is likely "13.5%" (ABV > 100% is impossible)
    if (val > 100) {
      // Try inserting a decimal: 135 → 13.5, 475 → 47.5
      const str = match[1];
      const fixed = str.slice(0, -1) + "." + str.slice(-1);
      val = parseFloat(fixed);
    }
    return val;
  }

  // Try just a plain number
  const plain = parseFloat(text);
  if (!isNaN(plain) && plain > 0 && plain <= 100) {
    return plain;
  }

  return null;
}

/**
 * Compare two ABV values with tolerance for minor OCR errors.
 *
 * @param extracted - ABV string from label OCR
 * @param expected - ABV string from application data
 * @returns Object with match, confidence, and details
 */
export function compareAbv(
  extracted: string | null,
  expected: string
): { match: boolean; confidence: number; details: string } {
  if (!extracted) {
    return { match: false, confidence: 0, details: "ABV not found on label" };
  }

  const extractedVal = normalizeAbv(extracted);
  const expectedVal = normalizeAbv(expected);

  if (extractedVal === null || expectedVal === null) {
    return {
      match: false,
      confidence: 0,
      details: `Could not parse ABV: extracted="${extracted}", expected="${expected}"`,
    };
  }

  const match = extractedVal === expectedVal;
  return {
    match,
    confidence: match ? 1 : 0,
    details: match
      ? `ABV match: ${extractedVal}% = ${expectedVal}%`
      : `ABV mismatch: label shows ${extractedVal}%, application says ${expectedVal}%`,
  };
}

// ---------------------------------------------------------------------------
// Net Contents Normalization
// ---------------------------------------------------------------------------

interface NormalizedVolume {
  value: number;
  unit: string; // normalized to lowercase: "ml", "l", "oz"
}

/**
 * Extract and normalize volume from a net contents string.
 *
 * @param text - Volume string like "750 mL", "1.75 L", "12 fl oz"
 * @returns Normalized volume object, or null if not found
 */
export function normalizeVolume(text: string): NormalizedVolume | null {
  if (!text) return null;

  const match = text.match(/(\d{1,4}\.?\d*)\s*(mL|ml|L|l|Liter|liter|oz|fl\.?\s*oz)/i);
  if (!match) return null;

  const value = parseFloat(match[1]);
  let unit = match[2].toLowerCase().replace(/\s+/g, "");

  // Normalize unit names
  if (unit === "liter") unit = "l";
  if (unit === "fl.oz" || unit === "floz") unit = "oz";

  return { value, unit };
}

/**
 * Compare two net contents values.
 */
export function compareNetContents(
  extracted: string | null,
  expected: string
): { match: boolean; confidence: number; details: string } {
  if (!extracted) {
    return {
      match: false,
      confidence: 0,
      details: "Net contents not found on label",
    };
  }

  const extractedVol = normalizeVolume(extracted);
  const expectedVol = normalizeVolume(expected);

  if (!extractedVol || !expectedVol) {
    return {
      match: false,
      confidence: 0,
      details: `Could not parse volume: extracted="${extracted}", expected="${expected}"`,
    };
  }

  // Convert to same unit for comparison (mL as base)
  const toMl = (v: NormalizedVolume): number => {
    if (v.unit === "l") return v.value * 1000;
    if (v.unit === "oz") return v.value * 29.5735;
    return v.value; // already mL
  };

  const extractedMl = toMl(extractedVol);
  const expectedMl = toMl(expectedVol);

  const match = Math.abs(extractedMl - expectedMl) < 1; // Within 1mL tolerance
  return {
    match,
    confidence: match ? 1 : 0,
    details: match
      ? `Volume match: ${extracted} = ${expected}`
      : `Volume mismatch: label shows ${extracted}, application says ${expected}`,
  };
}
