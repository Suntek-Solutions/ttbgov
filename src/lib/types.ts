/**
 * Shared TypeScript types for the TTB Label Verification App.
 *
 * These interfaces define the data flowing through the pipeline:
 * Image → OCR → Extraction → Verification → Results
 */

// ---------------------------------------------------------------------------
// OCR Layer
// ---------------------------------------------------------------------------

/** Raw output from the Tesseract.js OCR engine */
export interface OcrResult {
  /** Full extracted text from the label image */
  text: string;
  /** Overall OCR confidence score (0-100) */
  confidence: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

// ---------------------------------------------------------------------------
// Extraction Layer
// ---------------------------------------------------------------------------

/** A single extracted field with its value and confidence */
export interface FieldResult {
  /** Extracted value, or null if the field was not found */
  value: string | null;
  /** Confidence score for this specific field (0-1) */
  confidence: number;
}

/** Structured fields extracted from a label image via OCR */
export interface ExtractedFields {
  brandName: FieldResult;
  classType: FieldResult;
  alcoholContent: FieldResult;
  netContents: FieldResult;
  governmentWarning: FieldResult;
  producerInfo: FieldResult;
  countryOfOrigin: FieldResult;
  /** The full raw OCR text for reference */
  rawText: string;
}

// ---------------------------------------------------------------------------
// Verification Layer
// ---------------------------------------------------------------------------

/** Application data entered by the compliance agent */
export interface ApplicationData {
  brandName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  governmentWarning: string;
  producerInfo?: string;
  countryOfOrigin?: string;
}

/** Comparison method used for a field */
export type ComparisonMethod = "fuzzy" | "exact" | "numeric";

/** Result of comparing a single extracted field against application data */
export interface FieldVerificationResult {
  /** Which field was compared */
  field: string;
  /** Value extracted from the label (OCR) */
  extracted: string | null;
  /** Value from the application data (form) */
  expected: string;
  /** Whether the field matches */
  match: boolean;
  /** Similarity/confidence score (0-1) */
  confidence: number;
  /** Which comparison strategy was used */
  method: ComparisonMethod;
  /** Human-readable explanation of the result */
  details: string;
}

/** Full verification result for a single label */
export interface VerificationResult {
  /** Overall pass/fail */
  overall: "pass" | "fail";
  /** Per-field results */
  results: FieldVerificationResult[];
  /** Total processing time in milliseconds */
  processingTimeMs: number;
}

// ---------------------------------------------------------------------------
// API Layer
// ---------------------------------------------------------------------------

/** Response from POST /api/extract */
export interface ExtractResponse {
  success: boolean;
  fields?: ExtractedFields;
  error?: string;
  processingTimeMs: number;
}

/** Request body for POST /api/verify */
export interface VerifyRequest {
  extracted: ExtractedFields;
  application: ApplicationData;
}

/** Response from POST /api/verify */
export interface VerifyResponse {
  success: boolean;
  overall?: "pass" | "fail";
  results?: FieldVerificationResult[];
  error?: string;
  processingTimeMs: number;
}

/** Response from POST /api/batch */
export interface BatchResponse {
  success: boolean;
  results?: Array<{
    filename: string;
    extraction: ExtractedFields | null;
    error?: string;
  }>;
  totalProcessingTimeMs: number;
}
