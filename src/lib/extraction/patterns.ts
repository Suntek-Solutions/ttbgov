/**
 * Regex Patterns for Label Field Extraction
 *
 * These patterns are designed to match common alcohol label text formats
 * as extracted by Tesseract.js OCR. They account for minor OCR artifacts
 * like extra spaces, pipe characters, and line breaks.
 *
 * Tested against OCR output from all 5 generated test labels.
 */

// ---------------------------------------------------------------------------
// Alcohol Content (ABV)
// ---------------------------------------------------------------------------

/**
 * Matches ABV patterns like:
 *   "45% Alc./Vol. (90 Proof)"
 *   "40% Alc./Vol. (80 Proof)"
 *   "13.5% Alc./Vol."
 *   "135% Alc. Vol." (OCR artifact -- missing decimal)
 *   "47% Alc./Vol. (94 Proof)"
 */
export const ABV_PATTERN =
  /(\d{1,3}\.?\d*)\s*%\s*Alc[\s./]*Vol[\s.]*/i;

/**
 * Matches proof notation: "(90 Proof)", "(80 Proof)", etc.
 */
export const PROOF_PATTERN = /\((\d{1,3})\s*Proof\)/i;

// ---------------------------------------------------------------------------
// Net Contents
// ---------------------------------------------------------------------------

/**
 * Matches net content patterns like:
 *   "750 mL"
 *   "750mL"
 *   "1.75 L"
 *   "1 Liter"
 *   "375 ml"
 */
export const NET_CONTENTS_PATTERN =
  /(\d{1,4}\.?\d*)\s*(mL|ml|L|l|Liter|liter|oz|fl\.?\s*oz)/i;

// ---------------------------------------------------------------------------
// Government Warning
// ---------------------------------------------------------------------------

/**
 * Matches the government warning block. Captures everything from
 * "GOVERNMENT WARNING:" (or "Government Warning:") through the end
 * of the warning text (ending around "health problems").
 *
 * Handles OCR artifacts like line breaks, extra spaces, pipe chars.
 */
export const GOV_WARNING_PATTERN =
  /GOVERNMENT\s+WARNING\s*:|Government\s+Warning\s*:/i;

/**
 * The expected standard government warning text (1988 Alcoholic Beverage Labeling Act).
 * Used for exact comparison after extraction.
 */
export const STANDARD_WARNING_TEXT =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

// ---------------------------------------------------------------------------
// Producer Information
// ---------------------------------------------------------------------------

/**
 * Matches producer/bottler lines like:
 *   "Distilled and Bottled by Old Tom Distillery, Louisville, KY"
 *   "Distilled by Stone's Throw Distillery, Portland, OR"
 *   "Vinted and Bottled by Summit Creek Vineyards, Napa, CA"
 *   "Produced and Bottled by..."
 *   "Brewed by..."
 *   "Imported by..."
 */
export const PRODUCER_PATTERN =
  /((?:Distilled|Vinted|Produced|Brewed|Blended|Imported|Bottled|Made)(?:\s+and\s+(?:Bottled|Distilled|Produced))?\s+by\s+.+?)(?:\n|$)/i;

// ---------------------------------------------------------------------------
// Country of Origin
// ---------------------------------------------------------------------------

/**
 * Matches origin lines like:
 *   "Product of USA"
 *   "Product of France"
 *   "Imported from Scotland"
 *   "Product of the USA"
 */
export const ORIGIN_PATTERN =
  /Product\s+of\s+(?:the\s+)?([A-Za-z\s]+?)(?:\s*[|\n]|$)/i;

// ---------------------------------------------------------------------------
// Class/Type Designation
// ---------------------------------------------------------------------------

/**
 * Common class/type designations for alcohol beverages.
 * Used for keyword matching in OCR text.
 */
export const CLASS_TYPE_KEYWORDS = [
  // Whiskey/Bourbon
  "Straight Bourbon Whiskey",
  "Straight Bourbon Whisky",
  "Kentucky Straight Bourbon Whiskey",
  "Kentucky Straight Bourbon Whisky",
  "Small Batch Bourbon Whiskey",
  "Bourbon Whiskey",
  "Bourbon Whisky",
  "Tennessee Whiskey",
  "Straight Rye Whiskey",
  "Rye Whiskey",
  "Blended Whiskey",
  "Single Malt Scotch Whisky",
  "Canadian Whisky",
  "Irish Whiskey",
  // Wine
  "Cabernet Sauvignon",
  "Chardonnay",
  "Pinot Noir",
  "Merlot",
  "Sauvignon Blanc",
  "Pinot Grigio",
  "Riesling",
  "Zinfandel",
  "Syrah",
  "Malbec",
  "Red Wine",
  "White Wine",
  "Rosé",
  "Sparkling Wine",
  "Champagne",
  // Beer
  "India Pale Ale",
  "IPA",
  "Pale Ale",
  "Lager",
  "Pilsner",
  "Stout",
  "Porter",
  "Wheat Beer",
  "Amber Ale",
  // Spirits
  "London Dry Gin",
  "Gin",
  "Vodka",
  "Rum",
  "Tequila",
  "Mezcal",
  "Brandy",
  "Cognac",
];
