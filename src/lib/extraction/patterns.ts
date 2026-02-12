/**
 * Regex Patterns for Label Field Extraction
 *
 * These patterns are designed to match common alcohol label text formats
 * as extracted by Tesseract.js OCR. They account for minor OCR artifacts
 * like extra spaces, pipe characters, and line breaks.
 *
 * Tested against both AI-generated test labels AND real COLA label scans
 * from the TTB registry (spirits, beer, wine categories).
 */

// ---------------------------------------------------------------------------
// Alcohol Content (ABV)
// ---------------------------------------------------------------------------

/**
 * Matches ABV patterns across real COLA labels:
 *   "45% Alc./Vol. (90 Proof)"        -- standard US format
 *   "40% ALC. / VOL. (80 PROOF)"      -- Casamigos tequila
 *   "ALC 3.6% BY VOL"                 -- Barrilito beer
 *   "47% ALC./VOL."                   -- Monkey 47 gin
 *   "45.2% ALC/VOL (90.4 PROOF)"      -- Woodford Reserve
 *   "14% Alc. BY Vol."                -- Filadoro wine
 *   "13.5% Alc./Vol."                 -- standard wine
 *   "135% Alc. Vol." (OCR artifact)   -- missing decimal
 *   "CONTAINS LESS THAN 0.5% ALC"     -- near-beer
 *   "ALC 40% BY VOL (80 PROOF)"       -- South Bank gin
 */
export const ABV_PATTERN =
  /(?:ALC\.?\s*)?(\d{1,3}\.?\d*)\s*%\s*(?:Alc[\s./]*Vol|ALC[\s./]*VOL|ALC\b|BY\s*VOL)/i;

/** Alternate pattern: "ALC X% BY VOL" format (percentage after ALC) */
export const ABV_PATTERN_ALT =
  /ALC\.?\s+(\d{1,3}\.?\d*)\s*%\s*(?:BY\s*VOL|ALC[\s./]*VOL)/i;

/**
 * Matches proof notation: "(90 Proof)", "(80 Proof)", "(90.4 PROOF)", etc.
 */
export const PROOF_PATTERN = /\((\d{1,3}\.?\d*)\s*Proof\)/i;

// ---------------------------------------------------------------------------
// Net Contents
// ---------------------------------------------------------------------------

/**
 * Matches net content patterns from real COLA labels:
 *   "750 mL" / "750mL" / "750 ML"
 *   "750m" (OCR truncation of "mL")
 *   "1.75 L" / "1 Liter"
 *   "375 ml"
 *   "12 FL OZ (355 mL)"     -- Athletic Brewing
 *   "8FL.OZ."               -- Barrilito
 *   "1 QT., 8FL.OZ."        -- Barrilito (1 quart 8 fl oz)
 *   "NET WT 12 FL OZ"       -- cans
 */
export const NET_CONTENTS_PATTERN =
  /(?:NET\s*(?:WT|CONTENTS?)?\s*)?(\d{1,4}\.?\d*)\s*(mL|ml|ML|L|l|Liter|liter|FL\.?\s*OZ\.?|fl\.?\s*oz\.?|oz)\b/i;

/** Fallback: catches OCR-truncated units like "750m" (missing "L") at end of line */
export const NET_CONTENTS_PATTERN_ALT =
  /(\d{3,4})\s*m(?:\b|$)/i;

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
 * Matches producer/bottler/importer lines from real COLA labels:
 *   "Distilled and Bottled by Old Tom Distillery, Louisville, KY"
 *   "Distilled by Stone's Throw Distillery, Portland, OR"
 *   "Vinted and Bottled by Summit Creek Vineyards, Napa, CA"
 *   "Produced and Bottled by..."
 *   "Brewed by..."
 *   "IMPORTED BY: RR IMPORTACIONES INC."   -- Barrilito
 *   "Imported by BUTA DISTRIBUTORS INC"    -- Filadoro
 *   "produced and bottled by FILADORO..."  -- Filadoro wine
 *   "Brewed in Stratford, CT..."           -- Athletic Brewing
 */
export const PRODUCER_PATTERN =
  /((?:Distilled|Vinted|Produced|Brewed|Blended|Imported|Bottled|Made|Crafted)(?:\s+and\s+(?:Bottled|Distilled|Produced|Blended))?\s+by\s*:?\s*.+?)(?:\n|$)/i;

// ---------------------------------------------------------------------------
// Country of Origin
// ---------------------------------------------------------------------------

/**
 * Matches origin lines from real COLA labels:
 *   "Product of USA"
 *   "Product of France"
 *   "PRODUCT OF MEXICO"        -- Barrilito
 *   "PRODUCT OF ITALY"         -- Filadoro
 *   "Product of the USA"
 *   "Hecho Jalisco, Mexico"    -- (partial, not matched by this pattern)
 */
export const ORIGIN_PATTERN =
  /Product\s+of\s+(?:the\s+)?([A-Za-z\s]+?)(?:\s*[|\n.,]|$)/i;

// ---------------------------------------------------------------------------
// Class/Type Designation
// ---------------------------------------------------------------------------

/**
 * Common class/type designations for alcohol beverages.
 * Used for keyword matching in OCR text.
 * Expanded with real COLA designations found in the TTB registry.
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
  "Flavored Whiskey",
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
  "Sangiovese",
  "Tempranillo",
  "Red Wine",
  "White Wine",
  "Rosé",
  "Sparkling Wine",
  "Champagne",
  "Table Wine",
  "Dessert Wine",
  // Beer / Malt
  "India Pale Ale",
  "IPA",
  "Pale Ale",
  "Ale",
  "Lager",
  "Pilsner",
  "Stout",
  "Porter",
  "Wheat Beer",
  "Amber Ale",
  "Beer",
  "Cerveza",
  "Near Beer",
  "Malt Beverage",
  // Spirits
  "Schwarzwald Dry Gin",
  "London Dry Gin",
  "Dry Gin",
  "Gin",
  "Vodka",
  "Rum",
  "Tequila",
  "Mezcal",
  "Brandy",
  "Cognac",
  "Liqueur",
  "Cordial",
  "Anejo",
  "Reposado",
  "Blanco",
];
