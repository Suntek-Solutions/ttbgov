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
- Chose a persistent server deployment (Railway) over serverless (Vercel) to keep Tesseract.js OCR workers warm between requests
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
- Chose Tesseract.js, which runs entirely on the app server
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
- Preprocessing pipeline before OCR: grayscale conversion, contrast enhancement, sharpening, noise reduction, resize
- Graceful error messaging when OCR confidence is too low to produce reliable results

---

## Test Label Strategy

The spec encourages creating test labels and notes that AI image generation tools work well for this. We went further and sourced labels from three places to test against realistic conditions:

1. **TTB Public COLA Registry** -- Real approved label images downloaded from TTB's free public database (https://www.ttbonline.gov/colasonline/publicSearchColasBasic.do). No login required. These test against genuine label layouts, fonts, and formatting that Tesseract will encounter in production.

2. **AI-generated labels** -- Controlled test cases with specific pass/fail conditions: compliant label (all pass), wrong ABV (fail), title-case warning instead of all-caps (fail), brand name case mismatch (pass with fuzzy match), missing warning (flag). These prove each verification feature works correctly.

3. **Degraded images** -- Real or generated labels with simulated poor conditions: angled photo, low contrast, blur. These stress-test the image preprocessing pipeline and document the OCR's accuracy boundary.

All test labels are in `public/test-labels/` organized by source (`real/`, `generated/`, `degraded/`) with a README documenting the expected result for each image.

---

## Tools Used

| Tool | Version | Purpose |
|---|---|---|
| Next.js | _filled during build_ | Full-stack framework (React UI + API routes) |
| TypeScript | _filled during build_ | Type safety across the entire codebase |
| Tesseract.js | _filled during build_ | Local OCR engine (LSTM neural network) |
| sharp | _filled during build_ | Image preprocessing (native Node.js) |
| string-similarity | _filled during build_ | Fuzzy string comparison |
| Tailwind CSS | _filled during build_ | Utility-first styling |
| shadcn/ui | _filled during build_ | Accessible UI components |

---

## Assumptions

Key assumptions made during development (full list in `docs/considerations/assumptions.md`):

1. **Labels are standard image files** (JPEG, PNG) -- not PDFs or TIFFs
2. **Application data is entered manually** via form -- no COLA integration
3. **There is one standard government warning text** (Alcoholic Beverage Labeling Act of 1988)
4. **The 5-second target is end-to-end** from upload arrival to results display
5. **OCR accuracy with preprocessing is sufficient** for well-photographed labels

---

## Trade-offs & Limitations

| Decision | Trade-off | Why we accepted it |
|---|---|---|
| Tesseract.js over cloud AI | Lower accuracy on complex labels | No cloud dependency, works behind firewalls, meets the constraint Marcus described |
| Fuzzy matching over exact matching for text fields | Could allow false positives on genuinely different names | Dave's example showed exact matching produces false negatives that are worse for workflow |
| No database or persistent storage | Results are not saved between sessions | Marcus said "don't do anything crazy" -- prototype scope, no data retention needed |
| No PDF label support | Some real labels may arrive as PDFs | Spec shows image-based labels; PDF adds complexity for an edge case |
| No multi-language OCR | Cannot process non-English labels | TTB labels are English; extra language data increases deployment size for no value |
| Image preprocessing before OCR | Adds ~100-200ms to processing time | Dramatically improves OCR accuracy on imperfect images; well within time budget |

---

## What Would Change for Production

This is a prototype. A production deployment at TTB would require:

- **Azure hosting** on FedRAMP-certified infrastructure (matching their 2019 migration)
- **COLA integration** to pull application data directly instead of manual entry
- **Azure AI Document Intelligence** for higher-accuracy OCR (once firewall rules are configured)
- **User authentication and RBAC** for agent accounts
- **Audit logging** per federal document retention policies
- **Section 508 accessibility compliance** audit
- **Database** for processing history, batch tracking, and reporting
- **Load testing** for 150,000 labels/year throughput across 47 concurrent agents
