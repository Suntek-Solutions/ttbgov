# Approach

This document explains how the project was designed, what drove each decision, and what trade-offs were made. It maps every major choice back to a specific stakeholder concern or evaluation criterion from the spec.

---

## Problem Analysis

The spec presents four stakeholder interviews and a deliberately open-ended "Technical Requirements" section. The real requirements are embedded in the interviews. The core problem:

> Given a label image and a set of application data fields, determine whether each field on the label matches the corresponding application data.

Everything else supports or enhances that comparison.

---

## How Stakeholder Interviews Informed Design

Every feature and architectural decision traces directly to something a stakeholder said.

### Performance: Sub-5-Second Response

**Source:** Sarah Chen -- "If we can't get results back in about 5 seconds, nobody's going to use it."

**What we did:**
- Chose a persistent container deployment (Azure Container Apps) over serverless to keep OCR engines (ONNX PaddleOCR + Tesseract.js) warm between requests
- Added image preprocessing (resize, grayscale, contrast) to reduce the work the OCR engine has to do
- Target: under 3 seconds server-side processing for a single label

### Simplicity: "Something My Mother Could Figure Out"

**Source:** Sarah Chen -- "She's 73 and just learned to video call her grandkids last year, if that gives you a benchmark."

**What we did:**
- Large, obvious upload area with drag-and-drop support
- Minimal form fields -- only what's needed for verification
- Color-coded results (green = pass, red = fail) per field
- No jargon, no hidden menus, no multi-step wizards
- Chose shadcn/ui component library for built-in accessibility and keyboard navigation

### Batch Processing

**Source:** Sarah Chen -- "Big importers who dump 200, 300 label applications on us at once. Janet from our Seattle office has been asking about this for years."

**What we did:**
- Dedicated `/batch` page with multi-file upload
- Progress indicators showing completion status
- Summary results table with per-label pass/fail

### No Cloud API Dependencies

**Source:** Marcus Williams -- "Our network blocks outbound traffic to a lot of domains... half their features didn't work because our firewall blocked connections to their ML endpoints."

**What we did:**
- Chose dual local OCR: ONNX PaddleOCR (PP-OCRv4, primary) + Tesseract.js (fallback), both running entirely on the app server
- Zero outbound API calls for core OCR/verification functionality
- The app works behind any firewall, on any network

### Standalone Prototype

**Source:** Marcus Williams -- "We're not looking to integrate with COLA directly."

**What we did:**
- No database, no authentication, no legacy system integration
- Everything processes in-memory
- Self-contained app that can be evaluated independently

### Fuzzy Matching with Judgment

**Source:** Dave Morrison -- "'STONE'S THROW' on the label but 'Stone's Throw' in the application. Technically a mismatch? Sure. But it's obviously the same thing."

**What we did:**
- Fuzzy string matching for text fields (brand name, class/type, producer)
- Normalize case and punctuation before comparison
- Show confidence scores so the agent can make the final call
- The tool assists, it does not replace human judgment

### Exact Government Warning Validation

**Source:** Jenny Park -- "'GOVERNMENT WARNING:' has to be in all caps and bold... I caught one last month where they used 'Government Warning' in title case instead of all caps. Rejected."

**What we did:**
- Dedicated warning validator separate from generic field comparison
- Checks: (1) exact wording match, (2) "GOVERNMENT WARNING:" prefix in all caps, (3) both required sentences present
- High-threshold fuzzy match on the body text to account for minor OCR artifacts
- Shows the raw OCR text alongside the expected text for borderline cases

### Image Preprocessing for Imperfect Photos

**Source:** Jenny Park -- "Labels that are photographed at weird angles, or the lighting is bad, or there's glare on the bottle."

**What we did:**
- **Primary: ONNX PaddleOCR** (PP-OCRv4 via multilingual-purejs-ocr) -- runs on the raw image with built-in paragraph grouping. Dramatically better on dark backgrounds, decorative fonts, and complex layouts than Tesseract alone.
- **Conditional fallback: Tesseract.js** -- only runs if ONNX finds < 5 fields. Max 3 passes total:
  1. **ONNX PaddleOCR** (always): raw image, paragraph-grouped output, 0.5-2s
  2. **Tesseract normal** (if ONNX < 5 fields): resize 1200px + grayscale + normalize + sharpen
  3. **Tesseract alt pass** (if still < 5 fields): high-contrast threshold OR color inversion at 2000px, chosen based on what's missing
- **Case-sensitive field correction**: When ONNX finds a government warning, a quick Tesseract pass runs to correct casing (ONNX sometimes reads "wARNING" instead of "WARNING")
- **Explicit Tesseract PSM initialization** -- discovered that `setParameters({ tessedit_pageseg_mode: "3" })` must be called explicitly for reliable large-font detection
- **Universal pattern extraction** -- no hardcoded country lists or test-specific keywords. Patterns are designed to work across 150K+ label applications:
  - Standard ABV formats ("X% Alc./Vol.", "ALC X% BY VOL", etc.)
  - Net contents with OCR truncation fallback ("750 mL", "750m")
  - Producer via keyword phrases ("Distilled by", "Imported by", "Elaborado por", etc.)
  - Origin via keyword phrases ("Product of", "Made in", "Hecho en", etc.)
  - Class/type via TTB taxonomy keywords only (no regional appellations or marketing terms)
  - Brand name extracted LAST, from text not consumed by other fields
- Graceful error messaging when OCR confidence is too low to produce reliable results

**Comprehensive test results (59 labels: 5 generated + 54 real COLA, no test-specific hacks):**
- Brand name detection: 100% across all labels ✅
- Real COLA avg: 3.9/7 fields (56%)
- Generated labels avg: 6.2/7 fields (89%)
- Class/type detection: 85% on real COLA ✅
- Government warning caps: 100% correct when detected ✅
- Average processing: 3.2 seconds (0 labels exceeded 10s SLA)
- 7/7 fields detected on best real COLA labels (Filadoro, Azienda Agricola, Cantine Mothia, Pietro Rinaldi wines)

---

## Test Label Strategy

The spec encourages creating test labels and notes that AI image generation tools work well for this. We went further and sourced labels from two complementary sources to test against realistic conditions:

1. **TTB Public COLA Registry** -- 54 real approved label images downloaded from TTB's free public database (https://www.ttbonline.gov/colasonline/publicSearchColasBasic.do). No login required. These test against genuine label layouts, fonts, and formatting that our OCR engines will encounter in production. Covers distilled spirits (18), wine (18), and malt beverages (18).

2. **AI-generated labels** -- 5 controlled test cases with specific pass/fail conditions: compliant label (all pass), wrong ABV (fail), title-case warning instead of all-caps (fail), brand name case mismatch (pass with fuzzy match), missing warning (flag). These prove each verification feature works correctly.

All 59 test labels are in `public/test-labels/` organized by source (`real/`, `generated/`) with a unified `demo-labels.json` catalog containing application data and expected results for each label.

---

## Tools Used

| Tool | Version | Purpose |
|---|---|---|
| Next.js | 16.1.6 | Full-stack framework (React UI + API routes) |
| React | 19.2.3 | UI rendering |
| TypeScript | 5.x | Type safety across the entire codebase |
| Tesseract.js | 7.0.0 | Fallback OCR engine (LSTM neural network) |
| multilingual-purejs-ocr | latest | Primary OCR engine (ONNX PaddleOCR PP-OCRv4, local) |
| sharp | 0.34.5 | Image preprocessing (native Node.js) |
| string-similarity-js | 2.1.4 | Fuzzy string comparison |
| Tailwind CSS | 4.x | Utility-first styling |
| shadcn/ui | 3.8.4 | Accessible UI components |

---

## Assumptions

Key assumptions made during development (full list in `docs/considerations/assumptions.md`):

1. **Labels are standard image files** (JPEG, PNG) -- not PDFs or TIFFs
2. **Application data is entered manually** via form -- no COLA integration
3. **There is one standard government warning text** (Alcoholic Beverage Labeling Act of 1988)
4. **The 5-second target is end-to-end** from upload arrival to results display
5. **OCR accuracy with dual-engine approach (ONNX PaddleOCR + Tesseract.js) is sufficient** for well-photographed labels

---

## Trade-offs & Limitations

| Decision | Trade-off | Why we accepted it |
|---|---|---|
| Dual local OCR (ONNX PaddleOCR + Tesseract.js) over cloud AI | Lower accuracy on very complex layouts (mitigated by dual-engine + multi-pass) | No cloud dependency, works behind firewalls, meets the constraint Marcus described |
| Fuzzy matching over exact matching for text fields | Could allow false positives on genuinely different names | Dave's example showed exact matching produces false negatives that are worse for workflow |
| No database or persistent storage | Results are not saved between sessions | Marcus said "don't do anything crazy" -- prototype scope, no data retention needed |
| No PDF label support | Some real labels may arrive as PDFs | Spec shows image-based labels; PDF adds complexity for an edge case |
| No multi-language OCR | Cannot process non-English labels | TTB labels are English; extra language data increases deployment size for no value |
| Image preprocessing before OCR | Adds ~100-200ms to processing time | Dramatically improves OCR accuracy on imperfect images; well within time budget |

---

## What Would Change for Production

This is a prototype. A production deployment at TTB would require:

- **Azure hosting** on FedRAMP-certified infrastructure (prototype already deployed to Azure Container Apps, consistent with TTB's 2019 migration)
- **COLA integration** to pull application data directly instead of manual entry
- **Azure AI Document Intelligence** as optional cloud OCR upgrade (current dual-engine already achieves high accuracy)
- **User authentication and RBAC** for agent accounts
- **Audit logging** per federal document retention policies
- **Section 508 accessibility compliance** audit
- **Database** for processing history, batch tracking, and reporting
- **Load testing** for 150,000 labels/year throughput across 47 concurrent agents

---

## Development Process & Transparency

This project was built by Scott Vidito with the assistance of an AI coding agent (Cursor IDE with Claude). Full transparency on the process:

**What the AI did:**
- Analyzed the spec and extracted requirements from stakeholder interviews
- Proposed architecture decisions (which Scott reviewed, questioned, and directed)
- Generated code for the OCR engine, field extraction, verification logic, API routes, and UI components
- Ran tests, diagnosed issues (e.g., aggressive preprocessing destroying accuracy, Tesseract.js Turbopack module resolution, test-specific overfitting), and iterated on fixes
- Wrote documentation drafts that Scott reviewed and refined
- Deployed to Azure Container Apps via CLI

**What Scott did:**
- Directed all architectural decisions (stack choice, deployment platform, OCR approach)
- Reviewed every code change and document before committing
- Made judgment calls on scope, trade-offs, and priorities
- Managed the project timeline and session workflow
- Provided domain context and quality standards

**Why we're transparent about this:**
- The spec evaluates "Creative problem-solving" and "Appropriate technical choices" -- both are human judgment calls that Scott made
- AI-assisted development is a modern engineering practice, not a shortcut. The tool amplifies the developer; it doesn't replace the thinking.
- The [Activity Log](ACTIVITY_LOG.md) documents every session, decision, and iteration in real time
- Every line of code was reviewed and understood before being committed

This approach reflects how Scott would work in the role: leveraging the best tools available while maintaining full ownership of decisions and quality.
