# Test Labels

Test labels for validating the OCR extraction and verification pipeline.

---

## demo-labels.json

The `demo-labels.json` file is the single source of truth for all demo/test labels in the system. Each entry contains:

- `id` -- Unique identifier
- `name` -- Display name in the UI
- `description` -- What this label tests
- `category` -- `"generated"` (AI-created test scenarios) or `"real"` (from TTB COLA registry)
- `file` -- Path to the image file (relative to public/)
- `applicationData` -- Pre-fill data for the application form (brand, class/type, ABV, contents, warning, producer, origin)
- `expectedResult` -- What the verification should produce (for generated labels)
- `ttbId` -- TTB COLA ID (for real labels)

The UI loads this file in demo mode to populate the example label picker on both the single-label and batch pages.

---

## Sources

### `generated/` -- AI-Generated Test Scenarios (5 images)

Labels created with AI image generation tools (as the spec encourages). Each is designed to trigger a specific pass or fail condition.

| Image | Test Scenario | Expected |
|---|---|---|
| `compliant-label.png` | All fields match application data | Pass (except brand -- decorative font) |
| `wrong-abv.png` | Label: 40%, Application: 45% | Fail on ABV |
| `wrong-warning-case.png` | "Government Warning:" title case | Fail on warning prefix |
| `brand-case-mismatch.png` | "OLD TOM" vs "Old Tom" | Pass with fuzzy match |
| `missing-warning.png` | No warning on label | Fail on warning |

### `real/` -- TTB Public COLA Registry Labels (54 images)

Real approved labels downloaded from TTB's free public database. Organized by beverage type:

- `real/distilled_spirits/` -- 18 labels (bourbon, tequila, gin, brandy, liqueurs)
- `real/wine/` -- 18 labels (red, white, dessert wines from Italy)
- `real/malt_beverage/` -- 18 labels (ales, stouts, lagers, specialty malt beverages)

Source: https://www.ttbonline.gov/colasonline/publicSearchColasBasic.do

Full metadata for all 54 labels is in `real/metadata.json` including TTB IDs, class/type, origin, and source URLs.

---

## Adding New Labels

To add a new label to the demo system:

1. Place the image file in `generated/` or `real/<category>/`
2. Add an entry to `demo-labels.json` with the file path and application data
3. The UI will automatically pick it up in demo mode
