/**
 * Fuzzy String Matching Utilities
 *
 * Handles Dave Morrison's scenario:
 *   'STONE'S THROW' on the label vs 'Stone's Throw' in the application.
 *   "Technically a mismatch? Sure. But it's obviously the same thing."
 *
 * Strategy: Normalize both strings (lowercase, strip punctuation), then
 * compute similarity. Configurable threshold defaults to 85%.
 */

import { stringSimilarity } from "string-similarity-js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Default similarity threshold for a "match" (0-1) */
export const DEFAULT_THRESHOLD = 0.85;

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a string for comparison:
 *   - Lowercase
 *   - Strip common punctuation (apostrophes, hyphens, periods, commas)
 *   - Collapse whitespace
 *   - Trim
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[''`]/g, "") // Remove apostrophes/quotes
    .replace(/[-–—]/g, " ") // Hyphens to spaces
    .replace(/[.,;:!?()]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compare two strings with fuzzy matching.
 *
 * @param extracted - Text extracted from label (OCR)
 * @param expected - Text from application data (form)
 * @param threshold - Minimum similarity for a match (default 0.85)
 * @returns Object with match boolean, confidence score, and details
 */
export function fuzzyCompare(
  extracted: string,
  expected: string,
  threshold: number = DEFAULT_THRESHOLD
): { match: boolean; confidence: number; details: string } {
  // Handle null/empty cases
  if (!extracted && !expected) {
    return { match: true, confidence: 1, details: "Both empty" };
  }
  if (!extracted || !expected) {
    return {
      match: false,
      confidence: 0,
      details: extracted ? "Expected value is empty" : "Extracted value is missing",
    };
  }

  // Normalize both strings
  const normExtracted = normalizeText(extracted);
  const normExpected = normalizeText(expected);

  // Exact match after normalization
  if (normExtracted === normExpected) {
    return {
      match: true,
      confidence: 1,
      details: "Exact match after normalization",
    };
  }

  // Compute similarity
  const similarity = stringSimilarity(normExtracted, normExpected);

  const match = similarity >= threshold;
  const pct = Math.round(similarity * 100);

  return {
    match,
    confidence: similarity,
    details: match
      ? `Fuzzy match: ${pct}% similar (threshold: ${Math.round(threshold * 100)}%)`
      : `Mismatch: ${pct}% similar (threshold: ${Math.round(threshold * 100)}%)`,
  };
}
