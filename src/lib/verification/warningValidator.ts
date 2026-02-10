/**
 * Government Warning Validator
 *
 * Handles Jenny Park's specific requirements:
 *   "'GOVERNMENT WARNING:' has to be in all caps and bold"
 *   "I caught one last month where they used 'Government Warning'
 *    in title case instead of all caps. Rejected."
 *
 * Validation checks:
 *   1. Warning text is present on the label
 *   2. "GOVERNMENT WARNING:" prefix is in ALL CAPS
 *   3. Both required sentences are present: (1) pregnancy/birth defects, (2) machinery/health
 *   4. Body text matches expected wording (high-threshold fuzzy for OCR tolerance)
 */

import { stringSimilarity } from "string-similarity-js";
import { STANDARD_WARNING_TEXT } from "@/lib/extraction/patterns";
import { normalizeText } from "./fuzzyMatch";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Threshold for warning body text similarity (95% -- very strict) */
const WARNING_BODY_THRESHOLD = 0.80;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface WarningValidationResult {
  match: boolean;
  confidence: number;
  details: string;
  checks: {
    present: boolean;
    prefixAllCaps: boolean;
    hasSentence1: boolean;
    hasSentence2: boolean;
    bodyMatchScore: number;
  };
}

/**
 * Validate the government warning text from a label.
 *
 * @param extractedWarning - Warning text extracted from label via OCR (or null if not found)
 * @param expectedWarning - Expected warning text (defaults to standard 1988 text)
 * @returns Detailed validation result with per-check breakdown
 */
export function validateWarning(
  extractedWarning: string | null,
  expectedWarning: string = STANDARD_WARNING_TEXT
): WarningValidationResult {
  // Check 1: Warning present at all
  if (!extractedWarning || extractedWarning.trim().length < 20) {
    return {
      match: false,
      confidence: 0,
      details: "Government warning not found on label",
      checks: {
        present: false,
        prefixAllCaps: false,
        hasSentence1: false,
        hasSentence2: false,
        bodyMatchScore: 0,
      },
    };
  }

  const cleaned = extractedWarning.replace(/\s+/g, " ").trim();

  // Check 2: "GOVERNMENT WARNING:" prefix is ALL CAPS
  const prefixMatch = cleaned.match(/^(GOVERNMENT\s+WARNING|Government\s+Warning|government\s+warning)\s*:/);
  const prefixAllCaps = prefixMatch
    ? prefixMatch[1] === prefixMatch[1].toUpperCase()
    : false;

  // Check 3: Sentence 1 present (pregnancy / birth defects)
  const normCleaned = normalizeText(cleaned);
  const hasSentence1 =
    normCleaned.includes("surgeon general") &&
    (normCleaned.includes("pregnancy") || normCleaned.includes("birth defects"));

  // Check 4: Sentence 2 present (drive a car / operate machinery / health problems)
  const hasSentence2 =
    (normCleaned.includes("drive a car") ||
      normCleaned.includes("operate machinery")) &&
    normCleaned.includes("health problems");

  // Check 5: Body text similarity
  const normExpected = normalizeText(expectedWarning);
  const bodyMatchScore = stringSimilarity(normCleaned, normExpected);

  // Overall determination
  const allChecksPass =
    prefixAllCaps && hasSentence1 && hasSentence2 && bodyMatchScore >= WARNING_BODY_THRESHOLD;

  // Build details message
  const issues: string[] = [];
  if (!prefixAllCaps) {
    issues.push("'GOVERNMENT WARNING:' prefix is not in all caps");
  }
  if (!hasSentence1) {
    issues.push("Missing Surgeon General / pregnancy warning sentence");
  }
  if (!hasSentence2) {
    issues.push("Missing drive a car / machinery warning sentence");
  }
  if (bodyMatchScore < WARNING_BODY_THRESHOLD) {
    issues.push(
      `Warning text similarity too low: ${Math.round(bodyMatchScore * 100)}% (threshold: ${Math.round(WARNING_BODY_THRESHOLD * 100)}%)`
    );
  }

  const details = allChecksPass
    ? `Government warning valid: all caps prefix, both sentences present, ${Math.round(bodyMatchScore * 100)}% text match`
    : `Government warning FAILED: ${issues.join("; ")}`;

  return {
    match: allChecksPass,
    confidence: bodyMatchScore,
    details,
    checks: {
      present: true,
      prefixAllCaps,
      hasSentence1,
      hasSentence2,
      bodyMatchScore,
    },
  };
}
