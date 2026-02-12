/**
 * Regex Patterns for Label Field Extraction
 *
 * These patterns are designed to match common alcohol label text formats
 * as extracted by OCR engines. They account for minor OCR artifacts
 * like extra spaces, pipe characters, and line breaks.
 *
 * Design principle: patterns must be UNIVERSAL -- they should work for
 * any of the 150K+ label applications TTB processes annually, not just
 * our test set. No hardcoded country lists, no region-specific keywords.
 */

// ---------------------------------------------------------------------------
// Alcohol Content (ABV)
// ---------------------------------------------------------------------------

/**
 * Matches standard ABV patterns found on US alcohol labels:
 *   "45% Alc./Vol. (90 Proof)"        -- standard US format
 *   "40% ALC. / VOL. (80 PROOF)"      -- all-caps variant
 *   "ALC 3.6% BY VOL"                 -- beer format
 *   "47% ALC./VOL."                   -- compact format
 *   "45.2% ALC/VOL (90.4 PROOF)"      -- decimal ABV
 *   "14% Alc. BY Vol."                -- mixed case
 *   "13.5% Alc./Vol."                 -- standard wine
 */
export const ABV_PATTERN =
  /(?:ALC\.?\s*)?(\d{1,3}\.?\d*)\s*%\s*(?:Alc[\s./]*Vol|ALC[\s./]*VOL|ALC\b|BY\s*VOL)/i;

/** Alternate pattern: "ALC X% BY VOL" format (percentage after ALC keyword) */
export const ABV_PATTERN_ALT =
  /ALC\.?\s*(\d{1,3}\.?\d*)\s*%\s*(?:BY\s*VOL|ALC[\s./]*VOL|BYVOL)/i;

/** Minimal pattern: "ALC X%" without vol suffix (PaddleOCR splits "BY VOL" to separate line) */
export const ABV_PATTERN_MIN =
  /ALC\.?\s*(\d{1,3}\.?\d*)\s*%/i;

/**
 * Fuzzy fallback: matches standalone percentage in typical ABV range (3-70%).
 * Only used when stronger patterns fail AND nearby context contains alcohol keywords.
 */
export const ABV_PATTERN_FUZZY =
  /\b([3-9]|[1-6]\d|70)\.?\d*\s*%/;

/**
 * Matches proof notation: "(90 Proof)", "(80 Proof)", "(90.4 PROOF)", etc.
 */
export const PROOF_PATTERN = /\((\d{1,3}\.?\d*)\s*Proof\)/i;

// ---------------------------------------------------------------------------
// Net Contents
// ---------------------------------------------------------------------------

/**
 * Matches net content patterns found on alcohol labels:
 *   "750 mL" / "750mL" / "750 ML"
 *   "1.75 L" / "1 Liter"
 *   "375 ml"
 *   "12 FL OZ (355 mL)"
 *   "8FL.OZ."
 *   "NET WT 12 FL OZ"
 */
export const NET_CONTENTS_PATTERN =
  /(?:NET\s*(?:WT|CONTENTS?)?\s*)?(\d{1,4}\.?\d*)\s*(mL|ml|ML|L|l|Liter|liter|LITER|FL\.?\s*OZ\.?|fl\.?\s*oz\.?|oz|OZ)\b/i;

/** Fallback: catches OCR-truncated units like "750m" (missing "L") at end of line */
export const NET_CONTENTS_PATTERN_ALT =
  /(\d{3,4})\s*m(?:\b|$)/i;

/**
 * Fuzzy fallback: matches standalone volume numbers (common bottle sizes).
 * Only used when stronger patterns fail AND nearby context contains volume keywords.
 */
export const NET_CONTENTS_PATTERN_FUZZY =
  /\b(50|187|200|375|500|750|1000|1500|1750|[1-9]\d{2,3})\b/;

// ---------------------------------------------------------------------------
// Government Warning
// ---------------------------------------------------------------------------

/**
 * Matches the US government warning block.
 * TTB requires "GOVERNMENT WARNING:" with colon, in all caps.
 * We enforce the colon -- if OCR misses it, that's an OCR quality issue.
 */
export const GOV_WARNING_PATTERN =
  /GOVERNMENT\s+WARNING\s*:/i;

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
 * Matches producer/bottler/importer lines on alcohol labels.
 *
 * Standard US formats:
 *   "Distilled and Bottled by Old Tom Distillery, Louisville, KY"
 *   "Produced and Bottled by..."
 *   "Brewed by..."
 *   "IMPORTED BY: RR IMPORTACIONES INC."
 *   "Brewed in Stratford, CT..."
 *
 * Abbreviated formats:
 *   "Prod. by X" / "Mfg. by X" / "Dist. by X" / "Btld. by X"
 *
 * International formats:
 *   "Elaborado por" (Spanish) / "Produit par" (French)
 *   "Prodotto da" (Italian) / "Hergestellt von" (German)
 *   "Engarrafado por" (Portuguese)
 */
export const PRODUCER_PATTERN =
  /((?:Distilled|Vinted|Produced|Brewed|Blended|Imported|Bottled|Made|Crafted|Manufactured|Distributed|Prod\.|Mfg\.|Dist\.|Btld\.|Elaborado|Produit|Prodotto|Hergestellt|Engarrafado|Imbottigliato)(?:\s+(?:and|&|e|et|y|und)\s+(?:Bottled|Distilled|Produced|Blended|Btld\.))?(?:\s+(?:by|in|at|por|par|da|von|em)\s*:?\s*|:\s*).+?)(?:\n|$)/i;

// ---------------------------------------------------------------------------
// Country of Origin
// ---------------------------------------------------------------------------

/**
 * Matches origin lines on alcohol labels using universal keyword phrases.
 * This pattern captures the country/region name that follows the keyword.
 *
 *   "Product of USA" / "Product of France"
 *   "Made in USA" / "Made in Italy"
 *   "Imported from Mexico"
 *   "Produced in Scotland" / "Distilled in Kentucky"
 *   "Hecho en Mexico" (Spanish)
 *   "Produit de France" (French)
 *   "Prodotto di Italia" (Italian)
 */
export const ORIGIN_PATTERN =
  /(?:Product|Made|Produced|Distilled|Imported|Hecho|Produit|Prodotto|Hergestellt|Elaborado)\s+(?:of|in|from|en|de|di)\s+(?:the\s+)?([A-Za-z\s]+?)(?:\s*[|\n.,]|$)/i;

// ---------------------------------------------------------------------------
// Class/Type Designation
// ---------------------------------------------------------------------------

/**
 * Standard TTB class/type designations for alcohol beverages.
 * Based on TTB Beverage Alcohol Manual categories.
 *
 * This list contains ONLY recognized TTB class/type designations --
 * not regional appellations, marketing terms, or test-specific keywords.
 * Sorted longest-first at runtime for best match priority.
 */
export const CLASS_TYPE_KEYWORDS = [
  // Whiskey/Bourbon (TTB Class: Whisky)
  "Kentucky Straight Bourbon Whiskey",
  "Kentucky Straight Bourbon Whisky",
  "Straight Bourbon Whiskey",
  "Straight Bourbon Whisky",
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
  // Wine (TTB Class: Wine)
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
  // Beer / Malt Beverage (TTB Class: Malt Beverages)
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
  "Malt Beverage",
  // Spirits (TTB Class: Distilled Spirits)
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
  "Sake",
];
