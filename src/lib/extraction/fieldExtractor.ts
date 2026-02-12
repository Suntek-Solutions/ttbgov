/**
 * Field Extractor
 *
 * Parses raw OCR text into structured label fields.
 * Uses regex patterns + heuristic logic to identify:
 *   - Government warning (extracted FIRST -- anchors the text)
 *   - ABV (regex for "XX% Alc./Vol.")
 *   - Net contents (regex for "750 mL" etc.)
 *   - Producer info (regex for "Distilled by..." etc.)
 *   - Country of origin (regex for "Product of...")
 *   - Class/type (keyword matching against TTB designations)
 *   - Brand name (LAST -- whatever prominent text remains)
 *
 * Extraction order matters: by extracting known patterns first and
 * tracking which text regions they consume, brand name extraction
 * can safely take the first prominent remaining text without needing
 * hack exclusions for warning fragments, producer lines, etc.
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
  ABV_PATTERN_FUZZY,
  NET_CONTENTS_PATTERN,
  NET_CONTENTS_PATTERN_ALT,
  NET_CONTENTS_PATTERN_FUZZY,
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

/**
 * Track which line indices have been "consumed" by a field extraction.
 * Brand extraction uses this to avoid grabbing already-identified text.
 */
class ConsumedLines {
  private consumed = new Set<number>();

  mark(lineIndex: number): void {
    this.consumed.add(lineIndex);
  }

  markRange(startLine: number, endLine: number): void {
    for (let i = startLine; i <= endLine; i++) {
      this.consumed.add(i);
    }
  }

  isConsumed(lineIndex: number): boolean {
    return this.consumed.has(lineIndex);
  }

  /** Find which line(s) contain a given substring */
  findAndMark(lines: string[], substring: string): void {
    if (!substring) return;
    const lower = substring.toLowerCase().substring(0, 40); // Use first 40 chars for matching
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(lower)) {
        this.mark(i);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Individual Field Extractors
// ---------------------------------------------------------------------------

function extractGovernmentWarning(text: string): FieldResult {
  const warningStart = text.match(GOV_WARNING_PATTERN);

  if (!warningStart || warningStart.index === undefined) {
    return field(null, 0);
  }

  // Extract from the warning prefix through "health problems"
  const startIdx = warningStart.index;
  const textFromWarning = text.substring(startIdx);

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
    const hasPrefix = /^GOVERNMENT\s+WARNING\s*:/i.test(warningText);
    const hasBothSentences =
      warningText.includes("(1)") && warningText.includes("(2)");

    const confidence = hasPrefix && hasBothSentences ? 0.9 : 0.6;

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

function extractAbv(text: string): FieldResult {
  // Try the primary pattern first (most specific)
  let match = text.match(ABV_PATTERN);

  // Fall back to alternate pattern ("ALC X% BY VOL" with flexible spacing)
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

  // Fuzzy fallback: look for standalone percentages in typical ABV range (3-70%)
  // Only use if we have strong context clues (near "ALC", "VOL", "PROOF", etc.)
  const fuzzyMatch = text.match(ABV_PATTERN_FUZZY);
  if (fuzzyMatch) {
    const matchIndex = text.indexOf(fuzzyMatch[0]);
    const contextBefore = text.substring(Math.max(0, matchIndex - 30), matchIndex);
    const contextAfter = text.substring(matchIndex, matchIndex + 30);
    const hasAlcContext = /ALC|VOL|PROOF|ALCOHOL/i.test(contextBefore + contextAfter);

    if (hasAlcContext) {
      return field(`${fuzzyMatch[1]}% Alc./Vol.`, 0.6);
    }
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
    return field(`${altMatch[1]} mL`, 0.8);
  }

  // Fuzzy fallback: look for standalone numbers matching common bottle sizes
  // Only use if we have context clues (near "ML", "OZ", "CONTENTS", "NET", etc.)
  const fuzzyMatch = text.match(NET_CONTENTS_PATTERN_FUZZY);
  if (fuzzyMatch) {
    const matchIndex = text.indexOf(fuzzyMatch[0]);
    const contextBefore = text.substring(Math.max(0, matchIndex - 30), matchIndex);
    const contextAfter = text.substring(matchIndex, matchIndex + 30);
    const hasVolumeContext = /ML|mL|OZ|oz|LITER|NET|CONTENTS|VOLUME/i.test(contextBefore + contextAfter);

    if (hasVolumeContext) {
      const num = parseInt(fuzzyMatch[1]);
      const unit = "mL"; // Most alcohol is sold in mL
      return field(`${num} ${unit}`, 0.6);
    }
  }

  return field(null, 0);
}

function extractProducerInfo(text: string): FieldResult {
  // Primary pattern: "Distilled by...", "Produced by...", "Imported by...", etc.
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
  // Primary pattern: "Product of...", "Made in...", "Hecho en...", etc.
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
    // Case-insensitive search with WORD BOUNDARIES to prevent false positives
    // e.g., "Gin" must not match inside "ORIGINE" or "originale"
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(text)) {
      return field(keyword, 0.9);
    }
  }
  return field(null, 0);
}

function extractBrandName(
  text: string,
  classType: string | null,
  consumed: ConsumedLines,
  lines: string[]
): FieldResult {
  // Brand name is extracted LAST, after all other fields have been identified.
  // We use the ConsumedLines tracker to skip lines already claimed by other fields.
  // This eliminates the need for hack exclusions (SURGEON GENERAL, PREGNANCY, etc.)

  if (lines.length === 0) {
    return field(null, 0);
  }

  // Strategy 1: If we found a class/type, look for clean lines before it
  if (classType) {
    const classTypeIdx = lines.findIndex((line) =>
      line.toLowerCase().includes(classType.toLowerCase())
    );
    if (classTypeIdx > 0) {
      const brandLines = lines
        .slice(0, classTypeIdx)
        .filter((_l, i) => !consumed.isConsumed(i));
      const brand = brandLines
        .filter(
          (l) =>
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

  // Strategy 2: Look for ALL-CAPS lines that haven't been consumed
  for (let i = 0; i < lines.length; i++) {
    if (consumed.isConsumed(i)) continue;

    const line = lines[i];
    const stripped = line.replace(/[^A-Za-z\s]/g, "").trim();
    if (
      stripped.length > 2 &&
      stripped.length < 50 &&
      stripped === stripped.toUpperCase()
    ) {
      return field(stripped, 0.7);
    }
  }

  // Strategy 3: First clean unconsumed line
  for (let i = 0; i < lines.length; i++) {
    if (consumed.isConsumed(i)) continue;

    const line = lines[i];
    if (line.length > 2 && line.length < 60) {
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
 * Extraction order: warning -> ABV -> net contents -> producer -> origin ->
 * class/type -> brand name. This order ensures that known patterns are
 * extracted first, and brand name gets whatever prominent text remains.
 *
 * @param rawText - Raw text from OCR engine
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

  // Split into lines for consumed-line tracking
  const lines = cleaned
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  // Track which lines have been consumed by field extractions
  const consumed = new ConsumedLines();

  // --- Extract fields in priority order ---

  // 1. Government warning (highest priority -- anchors the text)
  const governmentWarning = extractGovernmentWarning(cleaned);
  if (governmentWarning.value) {
    consumed.findAndMark(lines, governmentWarning.value);
  }

  // 2. ABV
  const alcoholContent = extractAbv(cleaned);
  if (alcoholContent.value) {
    consumed.findAndMark(lines, alcoholContent.value);
  }

  // 3. Net contents
  const netContents = extractNetContents(cleaned);
  if (netContents.value) {
    consumed.findAndMark(lines, netContents.value);
  }

  // 4. Producer info
  const producerInfo = extractProducerInfo(cleaned);
  if (producerInfo.value) {
    consumed.findAndMark(lines, producerInfo.value);
  }

  // 5. Country of origin
  const countryOfOrigin = extractOrigin(cleaned);
  if (countryOfOrigin.value) {
    consumed.findAndMark(lines, countryOfOrigin.value);
  }

  // 6. Class/type
  const classType = extractClassType(cleaned);
  if (classType.value) {
    consumed.findAndMark(lines, classType.value);
  }

  // 7. Brand name (LAST -- uses whatever prominent text remains)
  const brandName = extractBrandName(cleaned, classType.value, consumed, lines);

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
