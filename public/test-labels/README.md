# Test Labels

Test labels for validating the OCR extraction and verification pipeline. Organized by source into three categories. Each test case documents the expected application data and the expected verification result.

---

## Sources

### `generated/` -- AI-Generated Controlled Test Cases (5 images)

Labels created with AI image generation tools (as the spec encourages). Each label is designed to trigger a specific pass or fail condition so we can demonstrate every verification feature. **These are the primary test labels.**

### `real/` -- TTB Public COLA Registry (planned -- empty)

Placeholder for real approved labels from TTB's free public database (https://www.ttbonline.gov/colasonline/publicSearchColasBasic.do). No login required. Reference application data for 3 approved COLA entries is documented below. Actual label images to be downloaded from the registry's "Printable Version" links in a future iteration.

### `degraded/` -- Imperfect Image Stress Tests (planned -- empty)

Placeholder for labels with simulated poor conditions (angle, blur, low contrast) to stress-test the image preprocessing pipeline. To be created in a future iteration.

---

## Reference: Real COLA Application Data

Sourced from TTB Public COLA Registry on 2026-02-09. Use these as form input when testing against real labels.

### Bourbon -- Trail View Whiskey

| Field | Value |
|---|---|
| TTB ID | 25042001000473 |
| Status | APPROVED |
| Brand Name | TRAIL VIEW WHISKEY |
| Fanciful Name | BOURBON |
| Class/Type | STRAIGHT BOURBON WHISKY |
| Origin | MASSACHUSETTS |
| Producer | GTS, M. S. WALKER, INC. |
| Address | 300 MEADOW RD, BOSTON, MA 02136 |
| Permit | DSP-MA-18 |
| Approval Date | 02/13/2025 |
| Registry URL | https://ttbonline.gov/colasonline/viewColaDetails.do?action=publicDisplaySearchBasic&ttbid=25042001000473 |

### Bourbon -- Kalifornia Distilleries

| Field | Value |
|---|---|
| TTB ID | 25135001000430 |
| Status | APPROVED |
| Brand Name | KALIFORNIA DISTILLERIES |
| Fanciful Name | BOURBON |
| Class/Type | BOURBON WHISKY |
| Origin | CALIFORNIA |
| Approval Date | 05/16/2025 |
| Registry URL | https://ttbonline.gov/colasonline/viewColaDetails.do?action=publicDisplaySearchBasic&ttbid=25135001000430 |

### Bourbon -- Belle Isle

| Field | Value |
|---|---|
| TTB ID | 25295001000017 |
| Status | APPROVED |
| Brand Name | BELLE ISLE |
| Fanciful Name | BOURBON |
| Class/Type | STRAIGHT BOURBON WHISKY |
| Origin | VIRGINIA |
| Approval Date | 11/19/2025 |
| Registry URL | https://ttbonline.gov/colasonline/viewColaDetails.do?action=publicDisplaySearchBasic&ttbid=25295001000017 |

---

## Test Cases: Expected Results

### Generated Labels

| Image | Scenario | Expected Result |
|---|---|---|
| `generated/compliant-label.png` | All fields match application data | All fields PASS |
| `generated/wrong-abv.png` | Label says 40%, application says 45% | ABV field FAIL, others PASS |
| `generated/wrong-warning-case.png` | "Government Warning" in title case | Warning field FAIL (prefix not all caps) |
| `generated/brand-case-mismatch.png` | "OLD TOM" on label, "Old Tom" in form | Brand PASS with fuzzy match (100% after normalization) |
| `generated/missing-warning.png` | No government warning on label | Warning field FAIL (missing) |

### Degraded Images (planned)

These would be created by taking a generated label and degrading it:

| Image (planned) | Condition | Purpose |
|---|---|---|
| `degraded/angled-shot.jpg` | Label at ~30 degree angle | Test preprocessing deskew/perspective handling |
| `degraded/low-contrast.jpg` | Washed out / overexposed | Test contrast enhancement |
| `degraded/blurry.jpg` | Simulated motion blur | Test sharpening pipeline; document accuracy limit |

---

## Notes

- The 5 generated labels in `generated/` are the primary test set and cover all verification features.
- The COLA registry reference data below provides real application field values for future testing with real label images.
- The `real/` and `degraded/` folders are placeholders for future iterations.
