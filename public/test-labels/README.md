# Test Labels

Test labels for validating OCR extraction and field verification.

This folder now includes a balanced public dataset from the TTB Public COLA Registry plus controlled generated labels for deterministic pass/fail checks.

---

## Dataset Summary

### `generated/` -- Controlled AI labels (5 images)

These are deterministic scenarios used to verify specific validation logic (ABV mismatch, warning format, missing warning, fuzzy brand matching).

### `real/` -- Public COLA labels (54 images)

Pulled from the free TTB Public COLA Registry and categorized by beverage type:

- `real/distilled_spirits/` -- 18 labels
- `real/wine/` -- 18 labels
- `real/malt_beverage/` -- 18 labels

Coverage target met: **all major beverage types represented** and **50+ total labels**.

### `degraded/` -- Stress-test placeholders

Reserved for manually degraded variants (blur, angle, contrast) to stress OCR preprocessing.

---

## Sources Used

- TTB Distilled Spirits labeling page:
  - https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/labeling
- TTB Public COLA Registry basic search:
  - https://www.ttbonline.gov/colasonline/publicSearchColasBasic.do
- Label detail and printable views:
  - `viewColaDetails.do?action=publicDisplaySearchBasic&ttbid=<id>`
  - `viewColaDetails.do?action=publicFormDisplay&ttbid=<id>`
- Public image endpoint used on printable pages:
  - `publicViewAttachment.do?filename=...&filetype=l`

No authenticated endpoints were used.

---

## Real Label Metadata

`real/metadata.json` contains one record per downloaded label with:

- `ttbid`
- `category`
- `completed_date`
- `brand_name`
- `fanciful_name`
- `class_type_code`
- `class_type_desc`
- `origin_code` / `origin_desc`
- `details_url`
- `printable_url`
- `attachment_url`
- `local_path`

Use this file to quickly select representative test labels or map labels back to source pages.

---

## Test Cases: Expected Results (Generated Set)

| Image | Scenario | Expected Result |
|---|---|---|
| `generated/compliant-label.png` | All fields match application data | All fields PASS |
| `generated/wrong-abv.png` | Label says 40%, application says 45% | ABV FAIL, others PASS |
| `generated/wrong-warning-case.png` | "Government Warning" in title case | Warning FAIL (prefix not all caps) |
| `generated/brand-case-mismatch.png` | "OLD TOM" on label, "Old Tom" in form | Brand PASS via fuzzy normalization |
| `generated/missing-warning.png` | Warning text omitted | Warning FAIL (missing) |

---

## Rebuild / Refresh Dataset

Run from repo root:

```bash
python scripts/collect_public_labels.py --min-count 54 --from-date 01/01/2024 --to-date 02/10/2026 --max-pages 80
```

Notes:

- The script balances download targets across `distilled_spirits`, `wine`, and `malt_beverage`.
- If fewer than requested labels are returned, widen date range or increase `--max-pages`.
