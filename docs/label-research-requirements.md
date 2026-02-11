# TTB Label Research & Requirements

Research summary from TTB's official labeling resources at [ttb.gov/regulated-commodities/labeling/labeling-resources](https://www.ttb.gov/regulated-commodities/labeling/labeling-resources). This document captures the mandatory labeling requirements across all three beverage types and how they map to our verification tool.

---

## Mandatory Label Fields by Beverage Type

TTB publishes a Beverage Alcohol Manual (BAM) for each commodity. The mandatory fields vary slightly by type but share a common core.

### Core Fields (All Beverage Types)

These fields are mandatory on **every** alcohol beverage label:

| Field | Mandatory | Our App Handles | Comparison Method |
|---|---|---|---|
| Brand Name | Yes | Yes | Fuzzy |
| Class/Type Designation | Yes | Yes | Fuzzy (40+ keywords) |
| Alcohol Content | Yes (with exceptions for some wine/beer) | Yes | Numeric normalization |
| Net Contents | Yes | Yes | Numeric + unit conversion |
| Name and Address of Bottler/Producer/Importer | Yes | Yes | Fuzzy |
| Country of Origin (imports) | Yes (imports only) | Yes | Fuzzy |
| Government Health Warning Statement | Yes (all beverages >=0.5% ABV) | Yes | Exact (4-check validator) |

### Distilled Spirits -- Additional Requirements (27 CFR Part 5)

Source: [Anatomy of a Distilled Spirits Label](https://www.ttb.gov/node/2547), [BAM Volume 2](https://www.ttb.gov/node/1547)

| Field | Mandatory | Notes |
|---|---|---|
| Statement of Age | Sometimes | Required for certain types (e.g., bourbon <4 years must state age) |
| Coloring/Flavoring/Blending Materials | Sometimes | Required when present |
| Standards of Fill | Yes | Must be an approved standard size (50mL, 200mL, 375mL, 750mL, 1L, 1.75L) |
| Fanciful Name | Sometimes | Required for Distilled Spirits Specialty (DSS) products |
| Proof Statement | Optional | May appear in parentheses alongside ABV if desired |

### Wine -- Additional Requirements (27 CFR Part 4)

Source: [BAM Volume 1](https://www.ttb.gov/node/1283)

| Field | Mandatory | Notes |
|---|---|---|
| Appellation of Origin | Sometimes | Required if vintage date is shown |
| Vintage Date | Optional | If shown, appellation rules apply |
| Varietal Designation | Optional | If shown, 75% minimum varietal content required |
| "Contains Sulfites" | Yes (when present) | Required if sulfite content >10 ppm |
| Estate Bottled | Optional | Strict requirements if claimed |

### Malt Beverages / Beer -- Additional Requirements (27 CFR Part 7)

Source: [BAM Volume 3](https://www.ttb.gov/node/307)

| Field | Mandatory | Notes |
|---|---|---|
| Alcohol Content | Varies by state | Some states require it, others prohibit it |
| Class/Type | Yes | Follows different classification than spirits |

---

## Government Health Warning Statement -- Detailed Requirements

Source: [TTB Health Warning Statement page](https://www.ttb.gov/node/2542), Alcoholic Beverage Labeling Act (ABLA) of 1988

### Exact Required Text

> GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.

### Formatting Rules

| Requirement | Rule |
|---|---|
| **When required** | All beverages containing >=0.5% ABV sold or distributed in the United States |
| **Prefix formatting** | "GOVERNMENT WARNING" must be in **capital letters** and **bold type** |
| **Body formatting** | Remainder of the statement may **NOT** appear in bold type |
| **Layout** | Must appear as a **continuous paragraph** |
| **Separation** | Must appear **separate and apart** from all other information |
| **Legibility** | Must appear in **readily legible print** on a **contrasting background** |
| **Placement** | May appear on front, back, or side label |

### Minimum Type Size Requirements

| Container Size | Minimum Type Size | Max Characters Per Inch |
|---|---|---|
| 237 mL (8 fl. oz.) or less | 1 mm | 40 |
| >237 mL to 3 liters | 2 mm | 25 |
| >3 liters | 3 mm | 12 |

### What Our App Checks

Our `warningValidator.ts` performs 4 checks:

1. **Present** -- Warning text exists on the label
2. **Prefix all caps** -- "GOVERNMENT WARNING:" is in capital letters (not title case)
3. **Sentence 1 present** -- Contains Surgeon General / pregnancy / birth defects
4. **Sentence 2 present** -- Contains drive a car / operate machinery / health problems

### What Our App Does NOT Check (prototype scope)

- Bold formatting detection (OCR extracts text, not formatting)
- Minimum type size measurement
- Characters per inch compliance
- Separation from other label text
- Contrasting background verification

These are visual/formatting checks that would require image analysis beyond OCR text extraction. Documented as a production enhancement in APPROACH.md.

---

## Alcohol Content -- Format Requirements

Source: [Anatomy of a Distilled Spirits Label](https://www.ttb.gov/node/2547)

### Acceptable Formats (Distilled Spirits)

- "___% Alc. By Vol."
- "Alcohol ___% by volume"
- "___% Alc./Vol."

### Proof Statement

Optional for distilled spirits. If included, must appear in the **same field of vision** as ABV and must be distinguished from the mandatory ABV statement (typically in parentheses).

Example: `45% Alc./Vol. (90 Proof)`

### What Our App Handles

Our `normalizers.ts` extracts the numeric ABV value from any of these formats and compares numerically. The regex pattern `(\d{1,3}\.?\d*)\s*%\s*Alc` handles all standard formats. Proof values are extracted separately.

---

## Net Contents -- Standards of Fill

Source: [Anatomy of a Distilled Spirits Label](https://www.ttb.gov/node/2547)

### Approved Standard Sizes (Distilled Spirits)

50 mL, 100 mL, 200 mL, 375 mL, 750 mL, 1 L, 1.75 L

### Acceptable Format

- "750 mL"
- "1 L"
- "1.75 L"

Our `normalizers.ts` extracts numeric value and unit, normalizes across formats (mL, L, oz), and compares with unit conversion.

---

## Brand Name Requirements

Source: [Anatomy of a Distilled Spirits Label](https://www.ttb.gov/node/2547)

Key rules from TTB:
- If no other brand name appears, the bottler/packer/importer name is treated as the brand name
- A class/type designation alone (e.g., "Rum", "Vodka") **cannot** be used as the brand name
- Must not mislead about age, origin, identity, or other characteristics
- Must appear in the **same field of vision** with alcohol content and class/type designation

### Implication for Our App

Our brand name extraction uses heuristic positioning (first prominent text before class/type). The fuzzy matching comparison is appropriate here since brand names may have minor formatting differences between the label and application.

---

## Class and Type Designation

Source: [BAM Chapter 4 (Spirits)](https://www.ttb.gov/system/files/images/pdfs/spirits_bam/chapter4.pdf), [Anatomy Tool](https://www.ttb.gov/node/2547)

Key rules:
- Must identify the product per established standards of identity
- Must appear in the same field of vision with brand name and alcohol content
- If it appears more than once, must be **consistent** wherever it appears
- Must appear **separate and apart** from additional information

### Our App's Coverage

Our `patterns.ts` contains 40+ recognized class/type designations covering bourbon, whiskey, rye, gin, vodka, rum, tequila, brandy, cognac, wine varietals, and beer styles. The keyword matching approach correctly identifies the class/type from OCR text.

---

## Name and Address

Source: [Anatomy of a Distilled Spirits Label](https://www.ttb.gov/node/2547)

Requirements:
- City and state of the bottler, distiller, processor, or importer
- Must match the name and address on the bottler's/importer's basic permit
- Common formats: "Distilled and Bottled by...", "Bottled by...", "Imported by..."

Our `patterns.ts` PRODUCER_PATTERN regex matches all common variations.

---

## Key TTB Resources Referenced

| Resource | URL | Used For |
|---|---|---|
| Labeling Resources Hub | https://www.ttb.gov/regulated-commodities/labeling/labeling-resources | Overview of all labeling requirements |
| Anatomy of a Distilled Spirits Label | https://www.ttb.gov/node/2547 | Field-by-field requirements for spirits |
| Anatomy of a Wine Label | https://www.ttb.gov/node/2249 | Wine-specific requirements |
| Anatomy of a Malt Beverage Label | https://www.ttb.gov/regulated-commodities/beverage-alcohol/beer/labeling/anatomy-of-a-malt-beverage-label-tool | Beer-specific requirements |
| BAM Vol 1 (Wine) | https://www.ttb.gov/node/1283 | Mandatory wine labeling |
| BAM Vol 2 (Distilled Spirits) | https://www.ttb.gov/node/1547 | Mandatory spirits labeling |
| BAM Vol 3 (Malt Beverages) | https://www.ttb.gov/node/307 | Mandatory beer labeling |
| Health Warning Statement | https://www.ttb.gov/node/2542 | Warning text, formatting, type size rules |
| Public COLA Registry | https://www.ttbonline.gov/colasonline/publicSearchColasBasic.do | Search approved labels |
| 27 CFR Part 5 (Spirits) | https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5 | Federal regulations for spirits labeling |
| 27 CFR Part 16 (Health Warning) | https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-16 | Federal regulations for health warning |

---

## Modifications Needed for Our App

After reviewing TTB's complete labeling requirements, our app correctly handles all 7 core mandatory fields. No code changes are required. The following are noted for awareness:

### Already Covered

- All 7 mandatory fields extracted and compared
- Government warning exact text validated with all-caps prefix check
- ABV numeric comparison handles all standard formats
- Net contents normalized across units
- Producer/bottler pattern matches all common formats
- Class/type keyword list covers major designations

### Documented as Production Enhancements (no changes needed for prototype)

- **Warning formatting checks** (bold, type size, characters per inch, contrasting background) -- requires image analysis beyond OCR
- **Standards of fill validation** -- verify net contents is an approved standard size
- **Beverage-type-specific fields** (age statement for spirits, sulfite declaration for wine, state-specific ABV rules for beer)
- **"Same field of vision" validation** -- verify brand, ABV, and class/type appear together on the label
- **Label consistency checks** -- verify class/type is consistent wherever it appears on the label
