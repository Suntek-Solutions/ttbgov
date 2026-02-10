# Activity Log

Project activity history for the TTB Label Verification App. Maintained throughout the entire project lifecycle for full transparency. Every entry includes a timestamp and a summary of what was done.

**Contributors:** Scott Vidito (developer) + AI assistant (Cursor)

---

## 2026-02-09 (Monday) -- Project Setup & Planning

- **2026-02-09 ~5:00 PM** -- Received take-home project spec from TTB hiring team. One-week deadline.

- **2026-02-09 ~5:15 PM** -- Converted PDF spec to markdown and broke it into focused reference documents in `docs/spec/`: interviews, requirements, sample label, deliverables, and evaluation criteria. Organized for quick lookup during development.

- **2026-02-09 ~5:30 PM** -- Created full project plan (`.cursor/plans/ttb_label_verification_app_cf38bd97.plan.md`). Read every stakeholder interview line by line and extracted implicit requirements, constraints, and preferences. Key architecture decisions: Next.js (TypeScript) full-stack, Tesseract.js for local OCR (no cloud API dependencies), Railway for persistent-server deployment, shadcn/ui + Tailwind for accessible UI. 11-step implementation sequence designed to front-load risk validation.

- **2026-02-09 ~6:00 PM** -- Created internal planning documents in `docs/considerations/`:
  - `rationale.md` -- Maps every stakeholder quote to a design decision. Covers the full decision tree: OCR engine (4 options evaluated), tech stack (4 options), deployment platform, matching strategy, image preprocessing.
  - `risks.md` -- 10 risks with severity ratings and specific pivot strategies. Top 3 (OCR accuracy, performance, field extraction) are validated in the first half of the build.
  - `assumptions.md` -- 12 assumptions with confidence levels and impact-if-wrong analysis. Cross-referenced to corresponding risks.

- **2026-02-09 ~6:30 PM** -- Created skeleton submission documents as living documents to be updated throughout the build:
  - `README.md` -- Quick start, features, tech stack with rationale, trade-offs, production roadmap
  - `docs/APPROACH.md` -- Stakeholder-to-decision mapping, tools, assumptions, trade-offs, what would change for production
  - `docs/ARCHITECTURE.md` -- System diagrams (mermaid), sequence diagram, module responsibilities, TypeScript interface skeletons, API route specs with example JSON, performance and deployment architecture

- **2026-02-09 ~7:00 PM** -- Set up AI tooling for the build. Evaluated available MCP servers and documented usage in `.cursor/rules/mcp-servers.mdc`. Resolved Context7 library IDs for all 6 stack libraries so documentation lookups are instant during coding. Key servers: Context7 (docs), Playwright (UI testing), 21st.dev Magic (component generation), Next.js DevTools (to add when dev server is running).

- **2026-02-09 ~7:30 PM** -- Final audit and first commit. Verified all cross-references across 18 files. Replaced Python `.gitignore` with Node.js/Next.js version. Created `.env.example`. Committed all 20 files as project foundation.

- **2026-02-09 ~7:15 PM** -- Expanded test label strategy and sourced initial reference data. Discovered TTB has a free Public COLA Registry with real approved label images (no login required). Plan now sources test labels from 3 places: (1) real labels from COLA registry, (2) AI-generated controlled pass/fail scenarios, (3) degraded images for preprocessing stress tests. Organized into `public/test-labels/real/`, `generated/`, `degraded/` with a README per folder. Updated plan, APPROACH.md, and README. Browsed the TTB Public COLA Registry and recorded real COLA application data for 3 approved bourbon labels (Trail View Whiskey, Kalifornia Distilleries, Belle Isle) with full field details and registry URLs. Created `public/test-labels/` folder structure (`real/`, `generated/`, `degraded/`) with a README documenting all test cases, expected results, and reference COLA data. Also fixed: marked documentation-init step as completed in plan, softened considerations/README.md language.

- **2026-02-09 ~7:30 PM** -- Generated 5 AI test label images and placed in `public/test-labels/generated/`:
  - `compliant-label.png` -- Old Tom Distillery bourbon, all fields correct (should pass all checks)
  - `wrong-abv.png` -- Stone's Throw bourbon, label shows 40% but application will say 45% (should fail ABV)
  - `wrong-warning-case.png` -- Copper Ridge rye, "Government Warning" in title case not all caps (should fail warning)
  - `brand-case-mismatch.png` -- Old Tom wine label, "OLD TOM" on label vs "Old Tom" in form (should pass with fuzzy match)
  - `missing-warning.png` -- Harbor Light gin, no government warning on label at all (should flag missing)

---

## Current Project State

**Phase:** Implementation (core engine built and validated)
**Next step:** Plan step 4 -- field extraction (regex + heuristic parsing of OCR text into structured fields)
**Plan reference:** `.cursor/plans/ttb_label_verification_app_cf38bd97.plan.md`

---

## Session Log

### Session 1 -- `v0.1-planning`

| | |
|---|---|
| **Date** | 2026-02-09 (Monday) |
| **Time** | 5:45 PM - 7:45 PM MST (~2 hours) |
| **Phase** | Project Setup & Planning |
| **Plan steps completed** | Step 1 (documentation init) |
| **Commit** | `v0.1-planning` |

**What was done:**
- Received and analyzed the take-home spec (PDF converted to markdown, broken into 5 reference docs)
- Created full project plan with 11-step implementation sequence and stakeholder requirements traceability
- Wrote internal planning docs: decision rationale, 10 risks with pivots, 12 assumptions with confidence ratings
- Created skeleton submission docs (README, APPROACH.md, ARCHITECTURE.md) as living documents
- Set up AI tooling: MCP server documentation, Context7 library IDs for all 6 stack libraries, Cursor rules
- Expanded test label strategy: sourced 3 real COLA datasets from TTB Public Registry, generated 5 AI test labels covering pass/fail scenarios
- Full repo audit: verified all cross-references, replaced Python .gitignore, created .env.example

**Next session:** Begin step 2 -- scaffold Next.js app with TypeScript, Tailwind CSS, shadcn/ui. Validate Tesseract.js OCR on generated test labels (step 3).

### Session 2 -- `v0.2-scaffold-and-ocr`

| | |
|---|---|
| **Date** | 2026-02-09 (Monday) |
| **Time** | ~7:50 PM - 8:30 PM MST (~40 min) |
| **Phase** | Implementation -- Steps 2 & 3 |
| **Plan steps completed** | Step 2 (project init), Step 3 (OCR engine) |
| **Commit** | `v0.2-scaffold-and-ocr` |

**What was done:**
- Scaffolded Next.js 16.1.6 with TypeScript, Tailwind CSS v4, App Router, src/ directory
- Installed and configured: Tesseract.js, sharp, string-similarity-js, shadcn/ui (button, card, badge, progress, separator)
- Configured next.config.ts for Turbopack (Next.js 16 default) + webpack fallback for Tesseract.js
- Created complete TypeScript interfaces in `src/lib/types.ts` (OcrResult, ExtractedFields, FieldResult, ApplicationData, VerificationResult, API request/response types)
- Set up full folder structure: `src/lib/ocr/`, `src/lib/extraction/`, `src/lib/verification/`, `src/app/api/` routes, `src/app/batch/`, `src/app/about/`
- Built OCR engine (`src/lib/ocr/engine.ts`): persistent Tesseract.js worker pool (2 workers, scheduler pattern, singleton initialization)
- Built image preprocessor (`src/lib/ocr/preprocessor.ts`): resize + grayscale + normalize + gentle sharpen
- **Critical finding during testing:** CLAHE preprocessing destroyed OCR accuracy (16% confidence, garbage text). Removed CLAHE; light-touch pipeline (resize + grayscale + normalize) achieves 85-95% confidence.
- Ran full OCR validation against all 5 test labels: **Risk #1 VALIDATED** (avg 85.6% confidence), **Assumption A2 VALIDATED** (max 990ms, well under 5s budget)
- Verified production build passes (`next build` succeeds)
- Zero linter errors across all new files

**OCR test results (all PASS):**
| Label | Confidence | Time | Key text extracted |
|---|---|---|---|
| compliant-label.png | 93% | 649ms | All fields correct |
| wrong-abv.png | 91% | 623ms | "40% Alc./Vol." correctly captured |
| missing-warning.png | 92% | 415ms | No warning text (correct) |
| wrong-warning-case.png | 77% | 628ms | "Government Warning:" title case captured |
| brand-case-mismatch.png | 75% | 990ms | "OLD TOM" and wine fields captured |

**Next session:** Step 4 (field extraction) and step 5 (verification logic) -- parse OCR text into structured fields and build the comparison engine.
