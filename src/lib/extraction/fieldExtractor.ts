/**
 * Field Extractor
 *
 * Parses raw OCR text into structured label fields.
 * Uses regex patterns + heuristic logic to identify:
 *   - Brand name (positional -- first prominent text)
 *   - Class/type (keyword matching against known designations)
 *   - ABV (regex for "XX% Alc./Vol.")
 *   - Net contents (regex for "750 mL" etc.)
 *   - Government warning (regex for warning block)
 *   - Producer info (regex for "Distilled by..." etc.)
 *   - Country of origin (regex for "Product of...")
 *
 * Usage:
 *   import { extractFields } from "@/lib/extraction/fieldExtractor";
 *   const fields = extractFields(ocrText, ocrConfidence);
 */

import type { ExtractedFields, FieldResult } from "@/lib/types";
import {
  ABV_PATTERN,
  ABV_PATTERN_ALT,
  ABV_PATTERN_MIN,
  NET_CONTENTS_PATTERN,
  NET_CONTENTS_PATTERN_ALT,
  GOV_WARNING_PATTERN,
  PRODUCER_PATTERN,
  ORIGIN_PATTERN,
  CLASS_TYPE_KEYWORDS,
} from "./patterns";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clean OCR artifacts: stray pipe chars, multiple spaces, leading/trailing noise */
function cleanOcrText(text: string): string {
  return text
    .replace(/[|]/g, "") // Remove pipe characters (OCR artifact)
    .replace(/[{}[\]]/g, "") // Remove brackets (OCR artifact)
    .replace(/[^\S\n]{2,}/g, " ") // Collapse multiple spaces/tabs (preserve newlines!)
    .replace(/^[^\S\n]+|[^\S\n]+$/gm, "") // Trim horizontal whitespace per line (preserve newlines!)
    .replace(/\n{3,}/g, "\n\n") // Collapse excessive blank lines
    .trim();
}

/** Create a FieldResult with value and confidence */
function field(value: string | null, confidence: number): FieldResult {
  return { value, confidence };
}

// ---------------------------------------------------------------------------
// Individual Field Extractors
// ---------------------------------------------------------------------------

function extractAbv(text: string): FieldResult {
  // Try the primary pattern first (most specific)
  let match = text.match(ABV_PATTERN);

  // Fall back to alternate pattern ("ALC X% BY VOL")
  if (!match) {
    match = text.match(ABV_PATTERN_ALT);
  }

  // Minimal fallback: "ALC X%" without vol suffix
  // (PaddleOCR often splits "BY VOL" to a separate line)
  if (!match) {
    match = text.match(ABV_PATTERN_MIN);
  }

  if (match) {
    // Reconstruct a clean ABV string from the match context
    const fullMatch = match[0].trim();
    // Look for proof in nearby text
    const matchIndex = text.indexOf(match[0]);
    const nearbyText = text.substring(matchIndex, matchIndex + 60);
    const proofMatch = nearbyText.match(/\(\d{1,3}\.?\d*\s*Proof\)/i);
    const abvString = proofMatch
      ? `${fullMatch} ${proofMatch[0]}`
      : fullMatch;
    return field(abvString.trim(), 0.95);
  }
  return field(null, 0);
}

function extractNetContents(text: string): FieldResult {
  const match = text.match(NET_CONTENTS_PATTERN);
  if (match) {
    return field(`${match[1]} ${match[2]}`, 0.95);
  }
  // Fallback: catches OCR-truncated "750m" (missing "L" in "mL")
  const altMatch = text.match(NET_CONTENTS_PATTERN_ALT);
  if (altMatch) {
    return field(`${altMatch[1]} mL`, 0.8); // Assume mL for 3-4 digit values
  }
  return field(null, 0);
}

function extractGovernmentWarning(text: string): FieldResult {
  const warningStart = text.match(GOV_WARNING_PATTERN);
  if (!warningStart || warningStart.index === undefined) {
    return field(null, 0);
  }

  // Extract from the warning prefix through "health problems"
  const startIdx = warningStart.index;
  const textFromWarning = text.substring(startIdx);

  // Find the end of the warning (ends around "health problems.")
  const endMatch = textFromWarning.match(/health\s+problems\.?/i);
  if (endMatch && endMatch.index !== undefined) {
    const endIdx = endMatch.index + endMatch[0].length;
    let warningText = textFromWarning.substring(0, endIdx);

    // Clean up the extracted warning
    warningText = warningText
      .replace(/\n/g, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/[|{}[\]]/g, "")
      .trim();

    // Determine confidence based on text quality
    const hasPrefix = /^GOVERNMENT\s+WARNING:/i.test(warningText);
    const hasBothSentences =
      warningText.includes("(1)") && warningText.includes("(2)");
    const confidence = hasPrefix && hasBothSentences ? 0.9 : 0.7;

    return field(warningText, confidence);
  }

  // If we found the start but not a clean end, extract a reasonable chunk
  const chunk = textFromWarning
    .substring(0, 400)
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return field(chunk, 0.5);
}

function extractProducerInfo(text: string): FieldResult {
  const match = text.match(PRODUCER_PATTERN);
  if (match) {
    const producer = match[1]
      .replace(/[|{}[\]]/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return field(producer, 0.85);
  }
  return field(null, 0);
}

function extractOrigin(text: string): FieldResult {
  const match = text.match(ORIGIN_PATTERN);
  if (match) {
    return field(`Product of ${match[1].trim()}`, 0.9);
  }
  return field(null, 0);
}

function extractClassType(text: string): FieldResult {
  // Try each known class/type keyword (longest first for best match)
  const sorted = [...CLASS_TYPE_KEYWORDS].sort(
    (a, b) => b.length - a.length
  );

  for (const keyword of sorted) {
    // Case-insensitive search in the cleaned text
    const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (regex.test(text)) {
      return field(keyword, 0.9);
    }
  }
  return field(null, 0);
}

function extractBrandName(text: string, classType: string | null): FieldResult {
  // The brand name is typically the first prominent text on the label.
  // Brand detection uses positional heuristics: text appearing before the class/type
  // line is likely the brand. Multi-pass OCR (PSM 3 + threshold + inversion) handles
  // most decorative fonts. Confidence is set lower for heuristic-based extraction.
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  if (lines.length === 0) {
    return field(null, 0);
  }

  // Strategy 1: If we found a class/type, look for clean lines before it
  if (classType) {
    const classTypeIdx = lines.findIndex((line) =>
      line.toLowerCase().includes(classType.toLowerCase())
    );
    if (classTypeIdx > 0) {
      const brandLines = lines.slice(0, classTypeIdx);
      const brand = brandLines
        .filter(
          (l) =>
            !ABV_PATTERN.test(l) &&
            !NET_CONTENTS_PATTERN.test(l) &&
            !GOV_WARNING_PATTERN.test(l) &&
            !PRODUCER_PATTERN.test(l) &&
            !ORIGIN_PATTERN.test(l) &&
            l.length > 2 &&
            l.length < 60 // Brand names are typically short
        )
        .join(" ")
        .trim();
      if (brand.length > 1) {
        return field(brand, 0.8);
      }
    }
  }

  // Strategy 2: Look for ALL-CAPS lines (brand names are often all caps)
  for (const line of lines) {
    const stripped = line.replace(/[^A-Za-z\s]/g, "").trim();
    if (
      stripped.length > 2 &&
      stripped.length < 50 &&
      stripped === stripped.toUpperCase() &&
      !ABV_PATTERN.test(line) &&
      !GOV_WARNING_PATTERN.test(line) &&
      !ORIGIN_PATTERN.test(line)
    ) {
      return field(stripped, 0.7);
    }
  }

  // Strategy 3: First clean line that isn't a known pattern
  for (const line of lines) {
    if (
      !ABV_PATTERN.test(line) &&
      !NET_CONTENTS_PATTERN.test(line) &&
      !GOV_WARNING_PATTERN.test(line) &&
      !PRODUCER_PATTERN.test(line) &&
      !ORIGIN_PATTERN.test(line) &&
      line.length > 2 &&
      line.length < 60
    ) {
      return field(line, 0.5);
    }
  }

  return field(null, 0);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract structured fields from raw OCR text.
 *
 * @param rawText - Raw text from Tesseract.js OCR
 * @param ocrConfidence - Overall OCR confidence (0-100) used to scale field confidence
 * @returns ExtractedFields with value and confidence per field
 */
export function extractFields(
  rawText: string,
  ocrConfidence: number = 80
): ExtractedFields {
  // Scale factor: if OCR confidence is low, reduce all field confidences
  const scale = Math.min(ocrConfidence / 100, 1);

  // Clean the raw text first
  const cleaned = cleanOcrText(rawText);

  // Extract each field
  const classType = extractClassType(cleaned);
  const brandName = extractBrandName(cleaned, classType.value);
  const alcoholContent = extractAbv(cleaned);
  const netContents = extractNetContents(cleaned);
  const governmentWarning = extractGovernmentWarning(cleaned);
  const producerInfo = extractProducerInfo(cleaned);
  const countryOfOrigin = extractOrigin(cleaned);

  // Apply OCR confidence scaling
  const scaleField = (f: FieldResult): FieldResult => ({
    value: f.value,
    confidence: Math.round(f.confidence * scale * 100) / 100,
  });

  return {
    brandName: scaleField(brandName),
    classType: scaleField(classType),
    alcoholContent: scaleField(alcoholContent),
    netContents: scaleField(netContents),
    governmentWarning: scaleField(governmentWarning),
    producerInfo: scaleField(producerInfo),
    countryOfOrigin: scaleField(countryOfOrigin),
    rawText,
  };
}
