# Assumptions

This document lists every assumption made during the planning phase that was not confirmed by deep research or explicit stakeholder statement. Each assumption is flagged with its source, what we assumed, and what changes if the assumption is wrong.

---

## A1: Local OCR Engines Can Achieve Acceptable Accuracy

**What we assumed:** ONNX PaddleOCR (primary) + Tesseract.js (fallback), combined with image preprocessing (grayscale, contrast enhancement, sharpening, resize), will produce OCR text that is accurate enough to extract structured label fields for the majority of well-photographed labels.

**Why we assumed this:** Tesseract is the most widely deployed open-source OCR engine. It uses an LSTM neural network and is well-documented for document and label scanning. We read Tesseract.js performance docs confirming improved accuracy in recent versions (v5+ reduced memory 47%, improved runtime). However, we did not test it on actual alcohol label images.

**What we did NOT confirm:**
- Accuracy on decorative/stylized fonts common on spirits labels
- Accuracy on curved text (labels wrapped around bottles)
- Accuracy on small-font government warning text
- Accuracy on labels with complex backgrounds (gold foil, embossing, textured paper)

**If this assumption is wrong:** See risks.md #1. Implemented ONNX PaddleOCR (multilingual-purejs-ocr) as primary engine -- validated in testing.

---

## A2: OCR Engines Complete Within 5 Seconds

**What we assumed:** ONNX PaddleOCR (0.5-2s) + persistent Tesseract.js worker pool (1-3s fallback) on Azure Container Apps will process a preprocessed label image in approximately 1-3 seconds, keeping total response time under 5 seconds.

**Why we assumed this:** Tesseract.js documentation states v5+ reduced first-time runtime by ~50% and recommends reusing workers. Benchmarks on typical hardware show sub-second to low-second processing for document images. The "warm worker" pattern avoids cold-start overhead. **Validated in testing: ONNX PaddleOCR avg 1-2s, Tesseract fallback when needed. All labels under 5.5s.**

**What we did NOT confirm:**
- Actual performance on Azure Container Apps' specific resource allocation under load
- Processing time for high-resolution label images vs. the typical documents in Tesseract benchmarks

**If this assumption is wrong:** See risks.md #2. We move to a paid tier, run OCR client-side, or reduce image resolution before processing.

---

## A3: Azure Container Apps Provides Sufficient Resources and Uptime

**What we assumed:** Azure Container Apps with 1 vCPU / 2GB RAM will provide enough resources for the prototype to remain accessible and performant during the evaluators' review period.

**Why we assumed this:** Deploying to an existing Azure subscription with established infrastructure. Azure Container Apps supports always-on containers with configurable CPU/memory. 2GB RAM is sufficient for the Next.js process + 2 Tesseract workers (~330MB combined).

**What we did NOT confirm:**
- Exact cold-start time if the container scales to zero and back
- Cost impact on the existing Azure subscription (expected to be minimal -- under $10/month)

**If this assumption is wrong:** Minimal risk. Azure Container Apps is a managed service on an account we already control. Resources can be adjusted via the deploy script configuration.

---

## A4: The Spec's Interviews Are Fictional Stakeholders, Not Real People

**What we assumed:** Sarah Chen, Marcus Williams, Dave Morrison, and Jenny Park are fictional personas created for the take-home exercise. Their quotes represent realistic but synthesized stakeholder input.

**Why we assumed this:** This is a take-home project attached to a job application. The conversational style, convenient diversity of viewpoints, and embedded "red herring" personal details (Annie rehearsal, Dave printing emails) are hallmarks of a well-crafted assessment scenario.

**What we did NOT confirm:** Whether these are real TTB employees. If they are, the tone of our documentation (treating their words as requirements to extract) is appropriate regardless, but we should be mindful not to be dismissive of their concerns.

**If this assumption is wrong:** No plan changes needed. We treat their input with full seriousness either way.

---

## A5: The Government Warning Text Has a Single Standard Version

**What we assumed:** There is one standard government warning that appears on all alcohol labels:

> GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.

We assumed our validator can hard-code this text as the expected value.

**Why we assumed this:** This is the warning text mandated by the Alcoholic Beverage Labeling Act of 1988 (27 U.S.C. 215). It has not changed since enactment. Jenny's interview confirmed word-for-word exactness is required.

**What we did NOT confirm:**
- Whether there are any approved alternate wordings for specific beverage types
- Whether the warning text has been updated or amended since 1988
- Whether labels for export or territorial sales have different warning requirements
- The exact formatting requirements beyond "GOVERNMENT WARNING:" in all caps (minimum font size, etc.)

**If this assumption is wrong:** We add a configurable warning text field or a lookup table of approved warning variants. Minor code change in `warningValidator.ts`.

---

## A6: The Spec Expects a Web Application (Not a CLI, Desktop App, or Mobile App)

**What we assumed:** The prototype should be a web application accessible via a browser URL.

**Why we assumed this:** The deliverables explicitly require a "Deployed Application URL" and a "Working prototype we can access and test." This implies a web app. Sarah's UX requirements (clean, obvious, no hunting for buttons) also align with a web interface.

**What we did NOT confirm:** This was not explicitly stated but is strongly implied. No pivot risk here.

**If this assumption is wrong:** Extremely unlikely given the deliverables section. No action needed.

---

## A7: Labels Are Provided as Standard Image Files (JPEG, PNG, WebP)

**What we assumed:** Users will upload label images in common image formats. We are not supporting PDF uploads, TIFF files, multi-page documents, or direct camera capture within the app.

**Why we assumed this:** The spec's sample label section describes image-based labels and encourages AI-generated test labels (which would be PNG/JPEG). The interviews reference "label artwork" and "photographed" labels, both suggesting image files.

**What we did NOT confirm:**
- Whether the real COLA system sends labels as PDFs, TIFFs, or other formats
- Whether evaluators will test with formats beyond JPEG/PNG
- Whether the app should support direct camera capture (take a photo of a bottle)

**If this assumption is wrong:** Adding PDF support requires a PDF-to-image conversion step (e.g., pdf.js or pdf-poppler). TIFF support requires sharp configuration. Camera capture requires WebRTC integration. All are additive, not architectural changes.

---

## A8: "Application Data" Is Entered Manually by the Agent (Not Uploaded from COLA)

**What we assumed:** The agent types the application data (brand name, ABV, class/type, etc.) into a form in our app, then the system compares it against what was extracted from the label image.

**Why we assumed this:** Marcus explicitly said not to integrate with COLA. The spec is a standalone prototype. There is no mention of a data feed, CSV upload, or API integration for application data.

**What we did NOT confirm:**
- Whether the evaluators expect a way to upload application data in bulk (e.g., CSV) for batch mode
- Whether there is a standard format for COLA application data that we should mimic
- Whether the form fields we chose (brand, ABV, class/type, net contents, warning, producer, origin) are the complete set

**If this assumption is wrong:** For single labels, this is fine. For batch mode, the user may expect to upload a spreadsheet of application data alongside the label images. If so, we add a CSV/JSON upload option to the batch page. This is additive work, not a redesign.

---

## A9: Next.js Is an Appropriate and Acceptable Stack Choice

**What we assumed:** The evaluators will judge the solution on its merits (working, clean, well-documented) and not penalize the choice of Next.js/TypeScript over Python, .NET, or another language.

**Why we assumed this:** The spec explicitly says "You are free to use any programming languages, frameworks, or libraries you prefer. We want to see what kind of engineering, design, and integration decisions you make." This is a clear invitation to choose the best tool for the job and defend the choice.

**What we did NOT confirm:**
- Whether the evaluators have a hidden preference for Python (the .gitignore suggests this was the default)
- Whether the team reviewing submissions has TypeScript expertise
- Whether .NET would score better given the existing COLA system is .NET

**If this assumption is wrong:** The code is clean, well-typed, and well-documented. Even a reviewer unfamiliar with TypeScript can follow the logic. The README explains the stack choice. If there is a strong preference we missed, it would be a learning for next time, but the spec's own words support our choice.

---

## A10: The 85% Fuzzy Match Threshold Is Appropriate for Brand Name Comparison

**What we assumed:** An 85% string similarity threshold (after normalization) is a good default for distinguishing "same brand, different formatting" from "actually different brand."

**Why we assumed this:** Dave's example -- 'STONE'S THROW' vs 'Stone's Throw' -- normalizes to identical strings (100% match). We need the threshold to catch near-misses while still flagging genuinely different names. 85% is a common default in fuzzy matching literature.

**What we did NOT confirm:**
- Whether 85% is too lenient (letting through actual mismatches)
- Whether 85% is too strict (flagging valid matches with minor OCR artifacts)
- What the actual distribution of brand name variations looks like in real COLA applications
- Whether different fields need different thresholds

**If this assumption is wrong:** The threshold should be configurable. We can expose it as a constant in the code and tune it during testing. If evaluators find edge cases, we adjust. This is a tuning parameter, not an architectural decision.

---

## A11: The Spec's "About 5 Seconds" Is the Total End-to-End Target

**What we assumed:** Sarah's 5-second threshold is for the full round trip: image upload, preprocessing, OCR, field extraction, and results display. Not just the OCR step.

**Why we assumed this:** Sarah said "get results back in about 5 seconds." From the agent's perspective, "results" means the full verification output, not an intermediate OCR step.

**What we did NOT confirm:**
- Whether the 5 seconds includes upload time (which depends on the user's network and image file size)
- Whether Sarah was being aspirational or literal
- Whether 7-8 seconds would be acceptable for complex labels

**If this assumption is wrong:** We control everything after the upload arrives at the server. If upload time is included, we need to recommend image compression or implement client-side resize before upload. The plan already includes image resizing in preprocessing, which also reduces upload size if done client-side.

---

## A12: Sharp Will Run in the Azure Docker Environment

**What we assumed:** The `sharp` Node.js library (which depends on native `libvips`) will install and run correctly inside a Docker container on Azure Container Apps.

**Why we assumed this:** Sharp is one of the most popular Node.js image processing libraries with excellent Docker support. Our Dockerfile uses `node:20-slim` which includes the necessary build tools, and sharp provides pre-built binaries for Linux x86.

**What we did NOT confirm:**
- Memory overhead of libvips in addition to Tesseract's memory footprint under production load

**If this assumption is wrong:** Fall back to Jimp (pure JavaScript, zero native deps). Slightly slower but zero installation risk.

---

## Summary: Assumption Risk Matrix

| ID | Assumption | Confidence | Impact if Wrong |
|---|---|---|---|
| A1 | Dual OCR accuracy on labels | MEDIUM | HIGH -- core feature breaks |
| A2 | 1-3 second OCR performance | MEDIUM | HIGH -- fails 5-second SLA |
| A3 | Azure Container Apps sufficiency | HIGH | LOW -- existing Azure account, adjustable resources |
| A4 | Fictional stakeholders | HIGH | NONE -- approach is same |
| A5 | Single government warning text | HIGH | LOW -- add lookup table |
| A6 | Web app expected | VERY HIGH | NONE |
| A7 | Standard image formats | HIGH | LOW -- additive support |
| A8 | Manual application data entry | HIGH | LOW -- add CSV upload |
| A9 | Next.js is acceptable | HIGH | LOW -- spec says "any language" |
| A10 | 85% fuzzy match threshold | MEDIUM | LOW -- tunable parameter |
| A11 | 5 seconds = full round trip | HIGH | LOW -- optimize upload |
| A12 | Sharp runs on Azure Docker | HIGH | LOW -- fall back to Jimp |

The assumptions with the lowest confidence and highest impact (A1, A2, A3) are all validated in the first half of the build sequence. This is intentional -- we resolve uncertainty before committing to the rest of the implementation.
