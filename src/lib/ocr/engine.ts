/**
 * Tesseract.js OCR Engine
 *
 * Manages a persistent worker pool for fast, repeated OCR processing.
 * Workers are created once on first use and reused across requests,
 * avoiding the 3-5 second cold start per request.
 *
 * Usage:
 *   import { recognizeImage } from "@/lib/ocr/engine";
 *   const result = await recognizeImage(imageBuffer);
 */

import { createWorker, createScheduler, type Worker, type Scheduler } from "tesseract.js";
import { join } from "path";
import type { OcrResult, ExtractedFields } from "@/lib/types";
import { preprocessImageHighContrast, preprocessImageInverted } from "@/lib/ocr/preprocessor";
import { extractFields } from "@/lib/extraction/fieldExtractor";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const WORKER_COUNT = 2; // Number of parallel OCR workers
const LANGUAGE = "eng"; // English labels only (per spec)

// ---------------------------------------------------------------------------
// Singleton Scheduler
// ---------------------------------------------------------------------------

let scheduler: Scheduler | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the Tesseract.js scheduler and worker pool.
 * Called automatically on first use. Safe to call multiple times.
 */
async function ensureInitialized(): Promise<Scheduler> {
  if (scheduler) return scheduler;

  // Prevent multiple simultaneous initializations
  if (!initPromise) {
    initPromise = (async () => {
      try {
        console.log(`[OCR Engine] Initializing ${WORKER_COUNT} Tesseract workers...`);
        const start = performance.now();

        const newScheduler = createScheduler();

        // Explicit worker path fixes Turbopack/Next.js module resolution issue
        // See: https://github.com/naptha/tesseract.js/blob/master/docs/faq.md
        const workerPath = join(
          process.cwd(),
          "node_modules",
          "tesseract.js",
          "src",
          "worker-script",
          "node",
          "index.js"
        );

        // Create workers in parallel for faster startup
        const workers: Worker[] = await Promise.all(
          Array.from({ length: WORKER_COUNT }, () =>
            createWorker(LANGUAGE, 1, { workerPath })
          )
        );

        // CRITICAL: Explicitly set PSM 3 (fully automatic page segmentation).
        // Without this explicit call, Tesseract.js skips large decorative text
        // (e.g., "OLD TOM DISTILLERY" in serif fonts). The setParameters call
        // triggers internal page analysis initialization that the default doesn't.
        // Discovered via diagnostic testing: default fails, explicit PSM 3 succeeds.
        for (const worker of workers) {
          await worker.setParameters({
            tessedit_pageseg_mode: "3" as unknown as string,
          });
          newScheduler.addWorker(worker);
        }

        scheduler = newScheduler;

        const elapsed = Math.round(performance.now() - start);
        console.log(`[OCR Engine] Ready. ${WORKER_COUNT} workers initialized in ${elapsed}ms`);
      } catch (error) {
        // Reset so next call retries initialization
        initPromise = null;
        console.error("[OCR Engine] Failed to initialize:", error);
        throw new Error(
          `OCR engine initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    })();
  }

  await initPromise;
  return scheduler!;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run OCR on an image buffer and return extracted text with confidence.
 *
 * @param imageBuffer - Raw image data (JPEG, PNG, WebP, etc.)
 * @returns OcrResult with text, confidence, and processing time
 */
export async function recognizeImage(imageBuffer: Buffer): Promise<OcrResult> {
  const start = performance.now();

  const sched = await ensureInitialized();

  const {
    data: { text, confidence },
  } = await sched.addJob("recognize", imageBuffer);

  const processingTimeMs = Math.round(performance.now() - start);

  console.log(
    `[OCR Engine] Recognized ${text.length} chars, confidence: ${confidence}%, time: ${processingTimeMs}ms`
  );

  return {
    text: text.trim(),
    confidence,
    processingTimeMs,
  };
}

/**
 * Count how many non-null fields with confidence > 0.2 an extraction has.
 * Used to pick the best result across multiple OCR passes.
 */
function countFields(f: ExtractedFields): number {
  const fields = [f.brandName, f.classType, f.alcoholContent, f.netContents,
    f.governmentWarning, f.producerInfo, f.countryOfOrigin];
  return fields.filter(r => r.value && r.confidence > 0.2).length;
}

/**
 * Merge the best field values from a secondary extraction into the primary.
 * Only overwrites fields that are null/missing in the primary.
 */
function mergeFields(primary: ExtractedFields, secondary: ExtractedFields): void {
  const keys: (keyof Omit<ExtractedFields, "rawText">)[] = [
    "brandName", "classType", "alcoholContent", "netContents",
    "governmentWarning", "producerInfo", "countryOfOrigin",
  ];
  for (const key of keys) {
    const pField = primary[key];
    const sField = secondary[key];
    if ((!pField.value || pField.confidence < 0.2) && sField.value && sField.confidence > 0.2) {
      primary[key] = sField;
    }
  }
}

/**
 * Multi-pass OCR with three strategies:
 *
 * Pass 1 (always): Normal preprocessing (resize + grayscale + normalize + sharpen)
 *   - Best for standard labels with dark text on light backgrounds
 *
 * Pass 2 (if fields missing): High-contrast threshold (resize + grayscale + threshold)
 *   - Recovers large decorative text destroyed by normalize()
 *   - e.g. "OLD TOM DISTILLERY" in oversized serif fonts
 *
 * Pass 3 (if fields still missing): Color inversion (resize + negate + grayscale + normalize)
 *   - For light-text-on-dark-background labels (Corte Adagio, Casamigos)
 *   - Converts light-on-dark to dark-on-light for Tesseract
 *
 * Results are merged: each pass fills in missing fields from previous passes.
 * Cost: ~500ms per additional pass. Only runs when fields are missing.
 *
 * @param preprocessedBuffer - Already preprocessed (normal) image buffer
 * @param rawImageBuffer - Original raw image buffer (for alternate preprocessing)
 * @returns ExtractedFields with best results merged across all passes
 */
export async function recognizeWithFallback(
  preprocessedBuffer: Buffer,
  rawImageBuffer: Buffer
): Promise<{ fields: ExtractedFields; ocrResult: OcrResult }> {
  const start = performance.now();

  // ---- Pass 1: Normal OCR ----
  const ocrResult = await recognizeImage(preprocessedBuffer);
  const fields = extractFields(ocrResult.text, ocrResult.confidence);
  const pass1Count = countFields(fields);

  console.log(
    `[OCR Multi-Pass] Pass 1 (normal): ${pass1Count}/7 fields, ` +
    `brand: "${fields.brandName.value ?? "null"}" (${fields.brandName.confidence})`
  );

  // Only skip fallbacks if ALL 7 fields were found on the first pass.
  // Even if pass 1 found 5-6 fields, pass 2 may recover the missing ones
  // (e.g., "750m" truncated in normal pass becomes "750 ml" in threshold pass).
  if (pass1Count >= 7) {
    console.log(`[OCR Multi-Pass] Pass 1 perfect (7/7). Done in ${Math.round(performance.now() - start)}ms`);
    return { fields, ocrResult };
  }

  // ---- Pass 2: High-contrast threshold ----
  let pass2Gained = 0;
  try {
    console.log("[OCR Multi-Pass] Running Pass 2 (high-contrast threshold)...");
    const hcBuffer = await preprocessImageHighContrast(rawImageBuffer);
    const hcOcr = await recognizeImage(hcBuffer);
    const hcFields = extractFields(hcOcr.text, hcOcr.confidence);
    const pass2Count = countFields(hcFields);
    pass2Gained = pass2Count - pass1Count;

    console.log(
      `[OCR Multi-Pass] Pass 2 result: ${pass2Count}/7 fields (+${pass2Gained}), ` +
      `brand: "${hcFields.brandName.value ?? "null"}" (${hcFields.brandName.confidence})`
    );

    // If pass 2 found MORE total fields, use it as the primary and merge pass 1 into it
    if (pass2Count > pass1Count) {
      mergeFields(hcFields, fields);
      hcFields.rawText = ocrResult.text + "\n\n--- HIGH-CONTRAST PASS (primary) ---\n\n" + hcOcr.text;
      Object.assign(fields, hcFields);
    } else {
      mergeFields(fields, hcFields);
      if (hcOcr.text !== ocrResult.text) {
        fields.rawText = ocrResult.text + "\n\n--- HIGH-CONTRAST PASS ---\n\n" + hcOcr.text;
      }
    }
  } catch (error) {
    console.error("[OCR Multi-Pass] Pass 2 failed:", error);
  }

  // Smart threshold for Pass 3 (expensive inversion):
  // - Skip if we already have 7/7 fields
  // - Skip if Pass 2 gained nothing AND we have 5+ fields (label is readable, just limited visible fields)
  // - Run if we have < 5 fields or if Pass 2 found new fields (suggests different preprocessing helps)
  const afterPass2 = countFields(fields);
  if (afterPass2 >= 7) {
    console.log(`[OCR Multi-Pass] Perfect after Pass 2 (7/7 fields). Done in ${Math.round(performance.now() - start)}ms`);
    return { fields, ocrResult };
  }

  if (pass2Gained <= 0 && afterPass2 >= 5) {
    // Pass 2 didn't help and we already have most fields -- the missing ones
    // are likely not on this label at all. Skip the expensive inversion pass.
    console.log(`[OCR Multi-Pass] Pass 2 gained nothing, have ${afterPass2}/7 fields. Skipping inversion. Done in ${Math.round(performance.now() - start)}ms`);
    return { fields, ocrResult };
  }

  // ---- Pass 3: Color inversion (for light-on-dark labels) ----
  // Uses a higher target resolution (2000px) for the inverted pass to preserve
  // thin/delicate fonts that get destroyed at 1200px after inversion.
  try {
    console.log("[OCR Multi-Pass] Running Pass 3 (color inversion for dark backgrounds)...");
    const invBuffer = await preprocessImageInverted(rawImageBuffer);
    const invOcr = await recognizeImage(invBuffer);
    const invFields = extractFields(invOcr.text, invOcr.confidence);
    const pass3Count = countFields(invFields);

    console.log(
      `[OCR Multi-Pass] Pass 3 result: ${pass3Count}/7 fields, ` +
      `brand: "${invFields.brandName.value ?? "null"}" (${invFields.brandName.confidence})`
    );

    // If inversion found MORE total fields, use it as primary
    const currentCount = countFields(fields);
    if (pass3Count > currentCount) {
      mergeFields(invFields, fields);
      invFields.rawText = (fields.rawText || ocrResult.text) + "\n\n--- INVERTED PASS (primary) ---\n\n" + invOcr.text;
      Object.assign(fields, invFields);
    } else {
      mergeFields(fields, invFields);
      fields.rawText = (fields.rawText || ocrResult.text) + "\n\n--- INVERTED PASS ---\n\n" + invOcr.text;
    }
  } catch (error) {
    console.error("[OCR Multi-Pass] Pass 3 failed:", error);
  }

  const totalElapsed = Math.round(performance.now() - start);
  console.log(`[OCR Multi-Pass] Final: ${countFields(fields)}/7 fields in ${totalElapsed}ms`);

  return { fields, ocrResult };
}

/**
 * Gracefully shut down the OCR engine and release all workers.
 * Call during server shutdown or when the engine is no longer needed.
 */
export async function terminateEngine(): Promise<void> {
  if (scheduler) {
    console.log("[OCR Engine] Shutting down...");
    await scheduler.terminate();
    scheduler = null;
    initPromise = null;
    console.log("[OCR Engine] Terminated.");
  }
}
