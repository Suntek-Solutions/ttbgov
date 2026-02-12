# Scripts Directory

This directory contains utility scripts for development, testing, deployment, and data collection. These are **developer tools** and are not needed for running the production application.

---

## Production Scripts

### `deploy-azure.sh`
**Purpose:** Deploys the application to Azure Container Apps  
**Status:** ✅ **Active** - Used for production deployments  
**Usage:** `./scripts/deploy-azure.sh`  
**Requirements:** Azure CLI, Docker  
**Documentation:** Referenced in `README.md` deployment section

Handles the complete Azure deployment pipeline:
- Creates/configures Azure Container Registry (ACR)
- Builds and pushes Docker image to ACR
- Creates/updates Container Apps environment
- Deploys the application

---

## Development & Testing Scripts

### `generate-demo-labels.ts`
**Purpose:** Generates `demo-labels.json` catalog from test labels  
**Status:** ✅ **Active** - Registered as npm script  
**Usage:** `npm run generate-demo-labels`  
**When to use:** After adding new test labels to regenerate the catalog

Creates the unified JSON catalog (`public/test-labels/demo-labels.json`) that powers the demo label picker in the UI. Scans both `generated/` and `real/` label directories and extracts metadata.

---

## Development Scripts (Historical/Ad-hoc)

These scripts were used during development for validation and testing. They're kept for reference but are not part of the regular workflow. The functionality they provide is now covered by the comprehensive Vitest test suite (`npm test`).

### `test-ocr.ts`
**Purpose:** Early validation of OCR engine on generated labels  
**Status:** 🟡 **Historical** - Superseded by `full-label-sweep.test.ts`  
**Usage:** `npx tsx scripts/test-ocr.ts`  
**Note:** Validates Risk #1 (OCR accuracy) and Assumption A1/A2 (preprocessing + timing)

### `test-pipeline.ts`
**Purpose:** Full pipeline test (OCR → Extraction → Verification) on 5 generated labels  
**Status:** 🟡 **Historical** - Superseded by unit tests + integration tests  
**Usage:** `npx tsx scripts/test-pipeline.ts`  
**Note:** Validates Risks #3, #4 (field extraction, government warning detection)

### `test-ui-flow.ts`
**Purpose:** Integration test that calls API endpoints directly (simulates UI flow)  
**Status:** 🟡 **Historical** - Superseded by `full-label-sweep.test.ts`  
**Usage:** `npx tsx scripts/test-ui-flow.ts` (requires dev server running)  
**Note:** Tests all 5 generated label scenarios via HTTP API

### `validate-demo-labels.ts`
**Purpose:** Quick validation of all demo labels via API  
**Status:** 🟡 **Historical** - Superseded by comprehensive test suite  
**Usage:** `npx tsx scripts/validate-demo-labels.ts` (requires dev server running)  
**Note:** Shorter version of `validate-all-labels.ts`, tests extraction only

### `validate-all-labels.ts`
**Purpose:** Full validation of all 59 labels (extraction + verification + batch)  
**Status:** 🟡 **Historical** - Superseded by `full-label-sweep.test.ts`  
**Usage:** `npx tsx scripts/validate-all-labels.ts` (requires dev server running)  
**Output:** Writes results to `validation-results.json`  
**Note:** Most comprehensive ad-hoc validation script

---

## Data Collection Scripts

### `collect_public_labels.py`
**Purpose:** Downloads real COLA label images from TTB public registry  
**Status:** 🔵 **Data Collection** - Used once, kept for reproducibility  
**Usage:** `python3 scripts/collect_public_labels.py`  
**Requirements:** Python 3, requests, beautifulsoup4  
**Note:** Downloads balanced dataset (distilled spirits, wine, malt beverage) and generates `metadata.json`

This script was used to build the `public/test-labels/real/` dataset. It's kept for documentation and reproducibility but doesn't need to be run again unless you want to refresh the COLA dataset.

---

## Generated Files

### `validation-results.json`
**Purpose:** Output file from `validate-all-labels.ts`  
**Status:** 🗑️ **Stale artifact** - From 2026-02-11, before ONNX integration  
**Safe to delete:** Yes - this is outdated test output, not source code

This file contains validation results from an older version of the system. The current test suite (`npm test`) provides more comprehensive and up-to-date validation results.

---

## Cleanup Recommendations

### Keep (Essential)
- ✅ `deploy-azure.sh` - Active production deployment
- ✅ `generate-demo-labels.ts` - Active npm script
- 🔵 `collect_public_labels.py` - Data provenance/reproducibility

### Keep (Historical Reference)
These scripts document the development process and validation approach. They're small (~4-9KB each) and don't impact the production build. Keep them for:
- Understanding the validation methodology
- Reference for future similar projects
- Ad-hoc testing during development

- 🟡 `test-ocr.ts`
- 🟡 `test-pipeline.ts`
- 🟡 `test-ui-flow.ts`
- 🟡 `validate-demo-labels.ts`
- 🟡 `validate-all-labels.ts`

### Remove (Stale Output)
- 🗑️ `validation-results.json` - Outdated test output (~50KB)

---

## Testing Strategy (Current)

The scripts in this directory were used for **iterative development and validation**. Now that the system is complete, testing is handled by:

1. **Unit Tests:** `npm test` - 98 tests covering all modules
2. **Integration Tests:** `src/lib/ocr/__tests__/full-label-sweep.test.ts` - Tests all 59 labels
3. **Documentation:** `docs/TEST_VALIDATION_SUMMARY.md` - Comprehensive validation results

The ad-hoc scripts remain as **development artifacts** showing the validation methodology, but the formal test suite is the source of truth.

---

## Documentation Status

This README documents all scripts in the directory. Each script includes:
- Clear purpose statement
- Current status (Active/Historical/Stale)
- Usage instructions
- Notes on when to use or why to keep

**Last Updated:** 2026-02-12
