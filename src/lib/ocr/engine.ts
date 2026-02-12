/**
 * Dual OCR Engine: ONNX PaddleOCR (primary) + Tesseract.js (fallback)
 *
 * Primary: multilingual-purejs-ocr (PP-OCRv4 via ONNX Runtime)
 *   - Dramatically better accuracy on real COLA labels
 *   - Built-in paragraph grouping with proper text spacing
 *   - 0.5-2s per label (faster than Tesseract multi-pass)
 *   - 100% local, zero API calls
 *
 * Fallback: Tesseract.js (LSTM) with conditional multi-pass preprocessing
 *   - Only runs if ONNX finds < 5 fields
 *   - Pass 1: Normal (resize + grayscale + normalize + sharpen)
 *   - Pass 2: High-contrast threshold OR color inversion (chosen based on need)
 *
 * Both engines run 100% locally -- zero cloud dependency.
 *
 * Max 3 passes total: ONNX -> Tesseract normal (conditional) -> alt pass (conditional)
 *
 * Usage:
 *   import { recognizeWithFallback } from "@/lib/ocr/engine";
 *   const { fields } = await recognizeWithFallback(preprocessed, raw);
 */

import { createWorker, createScheduler, type Worker, type Scheduler } from "tesseract.js";
import { join } from "path";
import type { OcrResult, ExtractedFields } from "@/lib/types";
import { preprocessImageHighContrast, preprocessImageInverted } from "@/lib/ocr/preprocessor";
import { extractFields } from "@/lib/extraction/fieldExtractor";
import { recognizeWithOnnx, isOnnxAvailable } from "@/lib/ocr/onnx";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_FIELD = { value: null, confidence: 0 };

/** Create an empty ExtractedFields object (used when all OCR engines fail) */
function createEmptyFields(): ExtractedFields {
  return {
    brandName: { ...EMPTY_FIELD },
    classType: { ...EMPTY_FIELD },
    alcoholContent: { ...EMPTY_FIELD },
    netContents: { ...EMPTY_FIELD },
    governmentWarning: { ...EMPTY_FIELD },
    producerInfo: { ...EMPTY_FIELD },
    countryOfOrigin: { ...EMPTY_FIELD },
    rawText: "",
  };
}

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
            tessedit_pageseg_mode: "3" as never,
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

/** All extractable field keys (dynamic -- add new fields here as TTB requirements expand) */
const FIELD_KEYS: (keyof Omit<ExtractedFields, "rawText">)[] = [
  "brandName", "classType", "alcoholContent", "netContents",
  "governmentWarning", "producerInfo", "countryOfOrigin",
];

/** Total number of fields the system tracks */
const TOTAL_FIELDS = FIELD_KEYS.length;

/**
 * Count how many non-null fields with confidence > 0.2 an extraction has.
 * Uses the dynamic FIELD_KEYS list -- NOT hardcoded to 7.
 */
function countFields(f: ExtractedFields): number {
  return FIELD_KEYS.map(k => f[k]).filter(r => r.value && r.confidence > 0.2).length;
}

/** Fields where case accuracy matters (e.g. "GOVERNMENT WARNING:" must be all caps) */
const CASE_SENSITIVE_FIELDS: Set<keyof Omit<ExtractedFields, "rawText">> = new Set([
  "governmentWarning",
]);

/**
 * Merge the best field values from a secondary extraction into the primary.
 *
 * For case-sensitive fields (governmentWarning): ALWAYS prefers the secondary
 * (Tesseract) version if both engines found the field. Tesseract is more
 * reliable for exact casing ("GOVERNMENT WARNING:" all caps) even when ONNX
 * has higher confidence with incorrect casing.
 *
 * For all other fields: replaces when secondary has higher confidence
 * or primary is missing.
 */
function mergeFields(primary: ExtractedFields, secondary: ExtractedFields): void {
  for (const key of FIELD_KEYS) {
    const pField = primary[key];
    const sField = secondary[key];

    if (!sField.value || sField.confidence <= 0.2) continue;

    // Case-sensitive fields: ALWAYS prefer secondary (Tesseract) when both
    // engines found the field. Tesseract preserves exact casing better.
    if (CASE_SENSITIVE_FIELDS.has(key) && pField.value && sField.value) {
      primary[key] = sField;
      continue;
    }

    // Default: replace if primary is empty or secondary has higher confidence
    if (!pField.value || pField.confidence < 0.2 || sField.confidence > pField.confidence) {
      primary[key] = sField;
    }
  }
}

/**
 * Dual-engine OCR: ONNX PaddleOCR primary, Tesseract conditional fallback.
 *
 * Simplified strategy (max 3 passes):
 * 1. ONNX PaddleOCR on raw image (best accuracy, 0.5-2s)
 * 2. Tesseract normal pass (only if ONNX found < 5 fields)
 * 3. Tesseract alt pass: threshold OR inversion (only if still < 5 fields)
 *
 * A persistent `best` variable accumulates the best field values across
 * all engines and passes. Each pass only fills in fields that are still missing.
 *
 * @param preprocessedBuffer - Preprocessed image buffer (for Tesseract)
 * @param rawImageBuffer - Original raw image buffer (for ONNX + alt preprocessing)
 * @returns ExtractedFields with best results merged across all engines
 */
export async function recognizeWithFallback(
  preprocessedBuffer: Buffer,
  rawImageBuffer: Buffer
): Promise<{ fields: ExtractedFields; ocrResult: OcrResult }> {
  const start = performance.now();

  // Accumulates the best fields across all engines/passes
  let best: ExtractedFields | null = null;
  let bestOcrResult: OcrResult = { text: "", confidence: 0, processingTimeMs: 0 };
  const rawTexts: string[] = [];

  // ---- OPTIMIZATION: Run ONNX and Tesseract in PARALLEL ----
  // This cuts 1-3 seconds off total time since we don't wait for ONNX
  // to finish before starting Tesseract. Max time = slower of the two,
  // not the sum of both.
  console.log("[OCR Engine] Running ONNX + Tesseract in parallel...");
  
  const [onnxAttempt, tessResult] = await Promise.allSettled([
    (async () => {
      const available = await isOnnxAvailable();
      if (!available) return null;
      return await recognizeWithOnnx(rawImageBuffer);
    })(),
    recognizeImage(preprocessedBuffer)
  ]);

  // Process ONNX results
  if (onnxAttempt.status === "fulfilled" && onnxAttempt.value) {
    const onnxResult = onnxAttempt.value;
    const onnxFields = extractFields(onnxResult.text, onnxResult.confidence);
    const onnxCount = countFields(onnxFields);

    console.log(
      `[OCR Engine] ONNX: ${onnxCount}/${TOTAL_FIELDS} fields, ` +
      `brand: "${onnxFields.brandName.value ?? "null"}" (${onnxFields.brandName.confidence})`
    );

    best = onnxFields;
    bestOcrResult = onnxResult;
    rawTexts.push(onnxResult.text);
  } else if (onnxAttempt.status === "rejected") {
    console.error("[OCR Engine] ONNX failed:", onnxAttempt.reason);
  }

  // Process Tesseract results
  if (tessResult.status === "fulfilled") {
    const tessOcr = tessResult.value;
    const tessFields = extractFields(tessOcr.text, tessOcr.confidence);
    const tessCount = countFields(tessFields);

    console.log(
      `[OCR Engine] Tesseract: ${tessCount}/${TOTAL_FIELDS} fields, ` +
      `brand: "${tessFields.brandName.value ?? "null"}" (${tessFields.brandName.confidence})`
    );

    if (!best) {
      // ONNX failed, use Tesseract as primary
      best = tessFields;
      bestOcrResult = tessOcr;
    } else {
      // Merge Tesseract into ONNX (fills missing, fixes casing)
      mergeFields(best, tessFields);
    }
    rawTexts.push(tessOcr.text);
  }

  // Safety: if both ONNX and Tesseract failed, return empty fields
  if (!best) {
    console.error("[OCR Engine] Both ONNX and Tesseract failed. Returning empty fields.");
    return { fields: createEmptyFields(), ocrResult: bestOcrResult };
  }

  // Check merged results
  const currentCount = countFields(best);
  const parallelTime = Math.round(performance.now() - start);
  console.log(`[OCR Engine] Parallel merge complete: ${currentCount}/${TOTAL_FIELDS} fields in ${parallelTime}ms`);

  // ---- OPTIMIZATION: Smarter early exit ----
  // Skip alt pass if we have good coverage (6-7 fields) OR
  // if government warning is already correct (all caps prefix check)
  if (currentCount >= 6) {
    best.rawText = rawTexts.join("\n\n---\n\n");
    console.log(`[OCR Engine] Strong coverage (${currentCount}/${TOTAL_FIELDS}). Done in ${parallelTime}ms`);
    return { fields: best, ocrResult: bestOcrResult };
  }

  // Also skip if we have 5 fields including a correctly-formatted government warning
  if (currentCount >= 5 && best.governmentWarning.value) {
    const warningText = best.governmentWarning.value;
    const hasCorrectPrefix = /^GOVERNMENT WARNING:/i.test(warningText);
    if (hasCorrectPrefix && best.governmentWarning.confidence >= 0.7) {
      best.rawText = rawTexts.join("\n\n---\n\n");
      console.log(`[OCR Engine] Good coverage with valid warning (${currentCount}/${TOTAL_FIELDS}). Done in ${parallelTime}ms`);
      return { fields: best, ocrResult: bestOcrResult };
    }
  }

  // ---- Pass 3: Alt preprocessing (threshold OR inversion) ----
  // Choose based on what's missing: if government warning is missing,
  // try high-contrast threshold (better for fine print). Otherwise,
  // try inversion (better for dark backgrounds).
  const missingWarning = !best.governmentWarning.value || best.governmentWarning.confidence < 0.3;

  try {
    if (missingWarning) {
      console.log("[OCR Engine] Running alt pass (high-contrast threshold)...");
      const altBuffer = await preprocessImageHighContrast(rawImageBuffer);
      const altOcr = await recognizeImage(altBuffer);
      const altFields = extractFields(altOcr.text, altOcr.confidence);
      const beforeMerge = countFields(best);
      mergeFields(best, altFields);
      const gained = countFields(best) - beforeMerge;
      rawTexts.push(altOcr.text);
      console.log(`[OCR Engine] Alt pass (threshold): +${gained} new fields, total: ${countFields(best)}/${TOTAL_FIELDS}`);
    } else {
      console.log("[OCR Engine] Running alt pass (color inversion)...");
      const invBuffer = await preprocessImageInverted(rawImageBuffer);
      const invOcr = await recognizeImage(invBuffer);
      const invFields = extractFields(invOcr.text, invOcr.confidence);
      const beforeMerge = countFields(best);
      mergeFields(best, invFields);
      const gained = countFields(best) - beforeMerge;
      rawTexts.push(invOcr.text);
      console.log(`[OCR Engine] Alt pass (inversion): +${gained} new fields, total: ${countFields(best)}/${TOTAL_FIELDS}`);
    }
  } catch (error) {
    console.error("[OCR Engine] Alt pass failed:", error);
  }

  best.rawText = rawTexts.join("\n\n---\n\n");
  const totalElapsed = Math.round(performance.now() - start);
  console.log(`[OCR Engine] Final: ${countFields(best)}/${TOTAL_FIELDS} fields in ${totalElapsed}ms`);

  return { fields: best, ocrResult: bestOcrResult };
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
