/**
 * Field-by-Field Comparator
 *
 * Compares extracted label fields against application data using
 * the appropriate strategy per field:
 *   - Text fields (brand, class/type, producer, origin): fuzzy matching
 *   - Numeric fields (ABV, net contents): numeric normalization
 *   - Government warning: dedicated exact validator
 *
 * This is the core verification engine that produces the per-field
 * pass/fail results shown to the compliance agent.
 *
 * Usage:
 *   import { compareFields } from "@/lib/verification/comparator";
 *   const result = compareFields(extractedFields, applicationData);
 */

import type {
  ExtractedFields,
  ApplicationData,
  FieldVerificationResult,
  VerificationResult,
  ComparisonMethod,
} from "@/lib/types";
import { fuzzyCompare } from "./fuzzyMatch";
import { compareAbv, compareNetContents } from "./normalizers";
import { validateWarning } from "./warningValidator";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compare all extracted fields against application data.
 *
 * @param extracted - Fields extracted from label via OCR
 * @param application - Application data entered by the agent
 * @returns Full verification result with per-field breakdown
 */
export function compareFields(
  extracted: ExtractedFields,
  application: ApplicationData
): VerificationResult {
  const start = performance.now();
  const results: FieldVerificationResult[] = [];

  // --- Brand Name (fuzzy) ---
  results.push(
    compareTextField(
      "brandName",
      extracted.brandName.value,
      application.brandName
    )
  );

  // --- Class/Type (fuzzy) ---
  results.push(
    compareTextField(
      "classType",
      extracted.classType.value,
      application.classType
    )
  );

  // --- ABV (numeric) ---
  const abvResult = compareAbv(
    extracted.alcoholContent.value,
    application.alcoholContent
  );
  results.push({
    field: "alcoholContent",
    extracted: extracted.alcoholContent.value,
    expected: application.alcoholContent,
    match: abvResult.match,
    confidence: abvResult.confidence,
    method: "numeric",
    details: abvResult.details,
  });

  // --- Net Contents (numeric) ---
  const netResult = compareNetContents(
    extracted.netContents.value,
    application.netContents
  );
  results.push({
    field: "netContents",
    extracted: extracted.netContents.value,
    expected: application.netContents,
    match: netResult.match,
    confidence: netResult.confidence,
    method: "numeric",
    details: netResult.details,
  });

  // --- Government Warning (exact) ---
  const warningResult = validateWarning(
    extracted.governmentWarning.value,
    application.governmentWarning
  );
  results.push({
    field: "governmentWarning",
    extracted: extracted.governmentWarning.value,
    expected: application.governmentWarning,
    match: warningResult.match,
    confidence: warningResult.confidence,
    method: "exact",
    details: warningResult.details,
  });

  // --- Producer Info (fuzzy, optional) ---
  if (application.producerInfo) {
    results.push(
      compareTextField(
        "producerInfo",
        extracted.producerInfo.value,
        application.producerInfo
      )
    );
  }

  // --- Country of Origin (fuzzy, optional) ---
  if (application.countryOfOrigin) {
    results.push(
      compareTextField(
        "countryOfOrigin",
        extracted.countryOfOrigin.value,
        application.countryOfOrigin
      )
    );
  }

  // Overall: fail if ANY required field fails
  const overall = results.every((r) => r.match) ? "pass" : "fail";
  const processingTimeMs = Math.round(performance.now() - start);

  return { overall, results, processingTimeMs };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compareTextField(
  field: string,
  extracted: string | null,
  expected: string
): FieldVerificationResult {
  const method: ComparisonMethod = "fuzzy";

  if (!extracted) {
    return {
      field,
      extracted,
      expected,
      match: false,
      confidence: 0,
      method,
      details: `${field} not found on label`,
    };
  }

  const result = fuzzyCompare(extracted, expected);
  return {
    field,
    extracted,
    expected,
    match: result.match,
    confidence: result.confidence,
    method,
    details: result.details,
  };
}
