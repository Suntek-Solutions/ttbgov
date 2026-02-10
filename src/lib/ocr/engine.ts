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
import type { OcrResult } from "@/lib/types";

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
      console.log(`[OCR Engine] Initializing ${WORKER_COUNT} Tesseract workers...`);
      const start = performance.now();

      const newScheduler = createScheduler();

      // Create workers in parallel for faster startup
      const workers: Worker[] = await Promise.all(
        Array.from({ length: WORKER_COUNT }, () => createWorker(LANGUAGE))
      );

      for (const worker of workers) {
        newScheduler.addWorker(worker);
      }

      scheduler = newScheduler;

      const elapsed = Math.round(performance.now() - start);
      console.log(`[OCR Engine] Ready. ${WORKER_COUNT} workers initialized in ${elapsed}ms`);
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
