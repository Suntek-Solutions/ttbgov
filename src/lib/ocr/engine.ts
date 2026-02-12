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
import { preprocessImageHighContrast } from "@/lib/ocr/preprocessor";
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
 * Multi-pass OCR: run normal OCR, then if brand name is missing, run a
 * high-contrast (binary threshold) pass and merge the brand from that pass.
 *
 * This addresses Tesseract's issue with large decorative brand-name text.
 * The normal pipeline (resize + normalize) can destroy oversized serif fonts.
 * The high-contrast pass uses binary thresholding which preserves them.
 *
 * Combined with explicit PSM 3 initialization on workers, this resolves
 * brand detection for labels like "OLD TOM DISTILLERY" that were previously
 * invisible to Tesseract.
 *
 * Cost: ~500ms extra only when brand is missing (one additional OCR pass).
 * Zero new dependencies.
 *
 * @param preprocessedBuffer - Already preprocessed (normal) image buffer
 * @param rawImageBuffer - Original raw image buffer (needed for inverted preprocessing)
 * @returns ExtractedFields with brand name filled from inverted pass if needed
 */
export async function recognizeWithFallback(
  preprocessedBuffer: Buffer,
  rawImageBuffer: Buffer
): Promise<{ fields: ExtractedFields; ocrResult: OcrResult }> {
  const start = performance.now();

  // ---- Pass 1: Normal OCR ----
  const ocrResult = await recognizeImage(preprocessedBuffer);
  const fields = extractFields(ocrResult.text, ocrResult.confidence);

  // Check if brand name was found
  if (fields.brandName.value && fields.brandName.confidence > 0.3) {
    console.log(
      `[OCR Multi-Pass] Brand found on first pass: "${fields.brandName.value}" (conf: ${fields.brandName.confidence})`
    );
    return { fields, ocrResult };
  }

  // ---- Pass 2: High-contrast OCR (brand name recovery) ----
  console.log("[OCR Multi-Pass] Brand not found on first pass. Running high-contrast pass...");
  const invertedStart = performance.now();

  try {
    const invertedBuffer = await preprocessImageHighContrast(rawImageBuffer);
    const invertedOcr = await recognizeImage(invertedBuffer);
    const invertedFields = extractFields(invertedOcr.text, invertedOcr.confidence);

    const hcElapsed = Math.round(performance.now() - invertedStart);
    console.log(
      `[OCR Multi-Pass] High-contrast pass complete in ${hcElapsed}ms. ` +
      `Brand: "${invertedFields.brandName.value}" (conf: ${invertedFields.brandName.confidence})`
    );

    // Merge: take brand name from inverted pass if it found one
    if (invertedFields.brandName.value && invertedFields.brandName.confidence > 0.2) {
      fields.brandName = invertedFields.brandName;
      // Also grab class/type from inverted pass if the normal pass missed it
      if (!fields.classType.value && invertedFields.classType.value) {
        fields.classType = invertedFields.classType;
      }
      // Append high-contrast raw text for debugging (separated by marker)
      fields.rawText =
        ocrResult.text +
        "\n\n--- HIGH-CONTRAST PASS ---\n\n" +
        invertedOcr.text;
    }
  } catch (error) {
    // High-contrast pass is best-effort; don't fail the whole extraction
    console.error("[OCR Multi-Pass] High-contrast pass failed:", error);
  }

  const totalElapsed = Math.round(performance.now() - start);
  console.log(`[OCR Multi-Pass] Total multi-pass time: ${totalElapsed}ms`);

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
