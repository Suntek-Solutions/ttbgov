# Risks: Hesitations, Concerns, and Potential Pivot Points

This document captures every area of the plan where there is risk, uncertainty, or a real chance we may need to change direction during execution. If something here turns out to be wrong, the corrective action is described alongside it.

---

## 1. Tesseract.js OCR Accuracy on Real Label Images

**The concern:** Tesseract.js is a general-purpose OCR engine. It was not built for alcohol label extraction specifically. Real-world labels have decorative fonts, curved text, overlapping design elements, gold foil, embossing, and low-contrast text on dark backgrounds. Tesseract may struggle with these compared to a cloud vision model like GPT-4o or Google Vision.

**Why this matters:** If the OCR cannot reliably extract text from the label image, the entire downstream pipeline (field extraction, comparison, verification) produces garbage. This is the single highest-risk component in the plan.

**What we planned:** Image preprocessing with sharp (grayscale, contrast boost, sharpening, resize) to maximize Tesseract accuracy before OCR runs.

**Where we might need to pivot:**
- If preprocessing + Tesseract cannot achieve acceptable accuracy on realistic label images during the OCR engine build step, we may need to switch to **PaddleOCR** (more capable on complex layouts, but requires a Python sidecar or subprocess).
- As a last resort, we could add an **optional cloud API mode** that is off by default but can be enabled with an API key. This keeps the local-first principle while giving evaluators a way to see higher accuracy. The trade-off is added complexity.
- We should test early with the actual test labels we create. Do not wait until the UI is built to discover the OCR is insufficient.

**Severity: HIGH. This is the first thing to validate.**

---

## 2. Tesseract.js Performance on Azure Container Apps

**The concern:** The plan targets ~1-3 seconds for OCR with a warm Tesseract worker. Azure Container Apps allocates configurable CPU/memory, but performance under load is unverified.

**Why this matters:** The previous scanning vendor was abandoned because it took 30-40 seconds. If our tool is slow, it fails the same test.

**What we planned:** Persistent worker pool on Azure Container Apps (1 vCPU, 2GB RAM) so workers stay warm between requests. Image preprocessing reduces the work Tesseract has to do.

**Status: LARGELY VALIDATED** -- Local testing shows avg 661ms processing across 5 labels. Azure performance should be comparable or better with 1 vCPU.

**Severity: LOW (validated locally). Final validation after deployment.**

---

## 3. Field Extraction from Raw OCR Text

**The concern:** Tesseract.js returns a flat block of text. It does not know what a "brand name" or "ABV" is. Our plan uses regex patterns and heuristic parsing to extract structured fields. This works well when the OCR text is clean and follows predictable patterns. It breaks when:
- The OCR misreads characters (e.g., "45%" becomes "4S%")
- Label layout causes text to appear in unexpected order
- Decorative text or background text gets mixed in with label text
- Multiple fields run together without clear separators

**Why this matters:** If we extract the wrong value for a field, the comparison will either false-pass or false-fail. Both undermine trust in the tool.

**What we planned:** Regex patterns in `src/lib/extraction/patterns.ts` plus heuristic logic in `fieldExtractor.ts` to handle common formats.

**Where we might need to pivot:**
- If regex parsing proves too brittle, we could add a **confidence score for each extracted field** and flag low-confidence extractions for the agent to review manually. This turns the tool from "automated checker" into "assisted checker" -- still valuable.
- We may need to build label-type-specific extraction logic (distilled spirits vs. wine vs. beer) since label layouts differ by beverage type.
- In the worst case, we present the raw OCR text alongside the form and let the agent manually map fields. Less automated, but still faster than reading a label by eye.

**Severity: MEDIUM-HIGH. Directly affects the "Correctness" evaluation criterion.**

---

## 4. Government Warning Detection

**The concern:** The government warning is a long paragraph of text. Tesseract may OCR it with minor errors (dropped letters, wrong punctuation, misread words) because the warning is often printed in very small font on labels. Jenny said it must be exact, word-for-word, with "GOVERNMENT WARNING:" in all caps. Even a single OCR misread would cause a false failure.

**Why this matters:** If the warning validator is too strict, it will reject labels that are actually compliant (because of OCR errors, not label errors). If it is too lenient, it defeats the purpose. Finding the right threshold is a design judgment call.

**What we planned:** Dedicated `warningValidator.ts` that checks exact text match plus all-caps formatting on the prefix.

**Where we might need to pivot:**
- We may need to use **fuzzy matching with a very high threshold** (e.g., 95%+) for the warning body text, while keeping the "GOVERNMENT WARNING:" prefix check strict/exact. This accounts for minor OCR artifacts without letting real violations through.
- We should surface the OCR confidence score for the warning section specifically, so the agent knows if the OCR is uncertain.
- We may need to let the agent see the raw OCR text of the warning side-by-side with the expected text, so they can make the final call on borderline cases.

**Severity: MEDIUM. Solvable with threshold tuning and UI design, but needs careful testing.**

---

## 5. The .gitignore Mismatch

**The concern:** The repo was initialized with a Python .gitignore. Our plan uses Next.js (TypeScript/Node.js). This is a cosmetic mismatch but an evaluator might notice and wonder why. It could signal that we did not pay attention to what was already in the repo, or it could look like we changed direction.

**Why this matters:** "Attention to requirements" is an evaluation criterion. Small inconsistencies can raise questions.

**What we will do:** Replace the .gitignore with a proper Node.js/Next.js .gitignore during project initialization. This is not a pivot -- just a cleanup task. But it is worth noting that the Python .gitignore was auto-generated by GitHub when the repo was created and does not indicate a preference for Python.

**Severity: LOW. Handled in step 1.**

---

## 6. Batch Upload at Scale (200-300 Labels)

**The concern:** Sarah mentioned importers dumping 200-300 labels at once. Processing 300 labels sequentially at ~3 seconds each is 15 minutes. That is far too long for an interactive experience. But parallel processing on a single container with limited resources could exhaust memory or CPU.

**Why this matters:** Batch upload was specifically requested by name. If it does not work at the scale Sarah described, it is an incomplete feature.

**What we planned:** Dedicated `/batch` page with multi-file upload and progress indicators.

**Where we might need to pivot:**
- We likely need to process labels in **parallel batches** (e.g., 3-5 at a time) rather than all at once, with a progress bar showing completion. This keeps memory manageable while still being much faster than one-at-a-time.
- The UI needs to handle this gracefully -- show a progress indicator, allow the agent to review completed results while others are still processing, and not time out.
- If the container cannot handle the memory footprint of multiple Tesseract workers, we may need to process sequentially with clear progress feedback ("Processing label 47 of 300...").
- Batch mode may end up as a "working but limited" feature with a documented note about scaling considerations. The spec says clean code is preferred over ambitious but incomplete features -- a working batch mode at 10-20 labels is better than a broken one at 300.

**Severity: MEDIUM. The feature will work; the question is at what scale.**

---

## 7. Deployment Uptime and Accessibility

**The concern:** The prototype needs to be accessible when the evaluators test it, which could be days or weeks after submission.

**Why this matters:** "Deployed Application URL -- Working prototype we can access and test" is an explicit deliverable.

**Status: MITIGATED.** Deploying to Azure Container Apps on an existing Azure subscription with min-replicas=1 (always-on). No free-tier expiration risk. The README includes local setup instructions as a fallback.

**Severity: LOW (mitigated by Azure deployment).**

---

## 8. What "AI-Powered" Means to the Evaluators

**The concern:** The spec title says "AI-Powered." Our plan uses Tesseract.js, which is OCR -- not what most people think of when they hear "AI" in 2025/2026. The evaluators may expect to see a large language model, a neural network, or something that feels more "intelligent" than pattern matching and fuzzy string comparison.

**Why this matters:** "Creative problem-solving" and "Appropriate technical choices for the scope" are evaluation criteria. If the evaluators expected a GPT integration and got Tesseract regex, there could be a perception gap.

**What we planned:** Tesseract.js (which is neural network-based OCR under the hood -- it uses an LSTM neural network) combined with intelligent field extraction and fuzzy matching logic.

**Where we might need to pivot:**
- Frame the documentation carefully: Tesseract IS a neural network. The LSTM-based OCR engine is machine learning. The fuzzy matching and field extraction are rule-based AI. This is a legitimate "AI-powered" application.
- If during implementation we feel the "AI" story is too thin, we could add a **lightweight local inference step** -- for example, using a small classifier to determine beverage type from the extracted text, or using NLP-based entity extraction instead of pure regex.
- The strongest defense is a working, accurate, fast tool. If it solves the problem well, the "is it AI enough?" question becomes academic.

**Severity: LOW-MEDIUM. Mostly a framing/documentation concern, but worth being aware of.**

---

## 9. Test Label Quality and Realism

**The concern:** The spec encourages creating test labels using AI image generation. AI-generated labels may look clean and well-structured -- perfect for OCR. Real labels have curved surfaces, reflective materials, handwritten batch numbers, stickers with wrinkles, and overlapping elements. If we only test with clean AI-generated images, we may give a false impression of accuracy.

**Why this matters:** If the evaluator tests with a real photo of a bottle and the OCR fails, the prototype looks bad regardless of how well it works on clean test images.

**What we will do:**
- Create a mix of clean and imperfect test labels.
- Include at least one image that simulates poor conditions (angled, low contrast, partial occlusion).
- Document in the README that OCR accuracy varies with image quality and list best practices for input images (flat label scan > angled photo).
- Be honest about this limitation in APPROACH.md.

**Severity: MEDIUM. Honesty about limitations is better than hiding them.**

---

## 10. Sharp (Image Processing Library) in Docker

**The concern:** `sharp` is a native Node.js module that depends on `libvips`. It works out of the box on most systems, but some Docker base images may be missing required libraries.

**Why this matters:** Without sharp, we lose the image preprocessing pipeline, which directly impacts OCR accuracy.

**Where we might need to pivot:**
- Our Dockerfile uses `node:20-slim` which includes necessary build tools. Sharp provides pre-built Linux x86 binaries.
- If sharp proves problematic, fall back to **Jimp** (pure JavaScript image processing, no native dependencies).

**Severity: LOW. Standard Docker configuration with pre-built binaries.**

---

## Summary: Risk Priority

| # | Concern | Severity | When we will know |
|---|---|---|---|
| 1 | Tesseract OCR accuracy | HIGH | During OCR engine build (step 2) |
| 2 | Performance on Azure | LOW (validated locally) | After deployment |
| 3 | Field extraction reliability | MEDIUM-HIGH | During extraction build (step 3) |
| 4 | Government warning detection | MEDIUM | During verification build (step 4) |
| 5 | .gitignore mismatch | LOW | Handled in step 1 |
| 6 | Batch at scale | MEDIUM | During batch UI build (step 7) |
| 7 | Deployment uptime | LOW (mitigated) | After deployment |
| 8 | "AI-powered" perception | LOW-MEDIUM | Documentation phase (step 9) |
| 9 | Test label realism | MEDIUM | During test label creation (step 8) |
| 10 | Sharp in Docker | LOW | During Docker build |

The top three risks (OCR accuracy, field extraction, performance) are all validated in the first half of the build. If any of them force a pivot, we will know before we have invested time in UI polish and documentation. This is by design -- the implementation order front-loads risk.
