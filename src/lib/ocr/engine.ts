/**
 * Dual OCR Engine: ONNX PaddleOCR (primary) + Tesseract.js (fallback)
 *
 * Primary: multilingual-purejs-ocr (PP-OCRv4 via ONNX Runtime)
 *   - Dramatically better accuracy on real COLA labels
 *   - Built-in paragraph grouping with proper text spacing
 *   - 0.5-2s per label (faster than Tesseract multi-pass)
 *   - 100% local, zero API calls
 *
 * Fallback: Tesseract.js (LSTM) with multi-pass preprocessing
 *   - Used when ONNX OCR is unavailable or for gap-filling
 *   - Pass 1: Normal (resize + grayscale + normalize + sharpen)
 *   - Pass 2: High-contrast threshold (binary threshold)
 *   - Pass 3: Color inversion at 2000px (for dark backgrounds)
 *
 * Both engines run 100% locally -- zero cloud dependency.
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
 * For case-sensitive fields (governmentWarning): prefers the secondary
 * version if it's within 20% confidence of the primary. This ensures
 * Tesseract's correct "GOVERNMENT WARNING:" (all caps) wins over ONNX's
 * "wARNING" (lowercase w) even when ONNX has marginally higher confidence.
 *
 * For all other fields: replaces when secondary has higher confidence
 * or primary is missing.
 */
function mergeFields(primary: ExtractedFields, secondary: ExtractedFields): void {
  for (const key of FIELD_KEYS) {
    const pField = primary[key];
    const sField = secondary[key];

    if (!sField.value || sField.confidence <= 0.2) continue;

    // Case-sensitive fields: prefer secondary (Tesseract) if within 20%
    // of primary confidence. Tesseract is more reliable for exact casing.
    if (CASE_SENSITIVE_FIELDS.has(key) && pField.value && sField.value) {
      const within20pct = sField.confidence >= pField.confidence * 0.8;
      if (within20pct) {
        primary[key] = sField;
        continue;
      }
      // Secondary confidence too low -- keep primary
      continue;
    }

    // Default: replace if primary is empty or secondary has higher confidence
    if (!pField.value || pField.confidence < 0.2 || sField.confidence > pField.confidence) {
      primary[key] = sField;
    }
  }
}

/**
 * Dual-engine OCR: ONNX PaddleOCR primary, Tesseract multi-pass fallback.
 *
 * Strategy:
 * 1. Try ONNX OCR on the raw image (best accuracy, 0.5-2s)
 * 2. Run Tesseract normal pass -- merge any new fields into best result
 * 3. If still < 7 fields, run Tesseract threshold/inversion passes
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
  let rawTexts: string[] = [];

  // ---- Engine 1: ONNX PaddleOCR (primary) ----
  try {
    const available = await isOnnxAvailable();
    if (available) {
      console.log("[OCR Engine] Trying ONNX PaddleOCR (primary)...");
      const onnxResult = await recognizeWithOnnx(rawImageBuffer);
      const onnxFields = extractFields(onnxResult.text, onnxResult.confidence);
      const onnxCount = countFields(onnxFields);

      console.log(
        `[OCR Engine] ONNX: ${onnxCount}/${TOTAL_FIELDS} fields, ` +
        `brand: "${onnxFields.brandName.value ?? "null"}" (${onnxFields.brandName.confidence})`
      );

      best = onnxFields;
      bestOcrResult = onnxResult;
      rawTexts.push(onnxResult.text);

      // Always run Tesseract normal pass even if ONNX found all fields.
      // Tesseract often has higher per-field confidence (e.g. correct
      // "GOVERNMENT WARNING:" caps vs ONNX's "wARNING" typo).
      // mergeFields picks the higher-confidence version of each field.
    }
  } catch (error) {
    console.error("[OCR Engine] ONNX failed:", error);
  }

  // ---- Engine 2: Tesseract normal pass ----
  const tessResult = await recognizeImage(preprocessedBuffer);
  const tessFields = extractFields(tessResult.text, tessResult.confidence);
  const tessCount = countFields(tessFields);

  console.log(
    `[OCR Engine] Tesseract normal: ${tessCount}/${TOTAL_FIELDS} fields, ` +
    `brand: "${tessFields.brandName.value ?? "null"}" (${tessFields.brandName.confidence})`
  );

  if (!best) {
    best = tessFields;
    bestOcrResult = tessResult;
  } else {
    // Merge Tesseract into ONNX results (only fills missing fields)
    mergeFields(best, tessFields);
  }
  rawTexts.push(tessResult.text);

  // Check if we have enough after ONNX + Tesseract normal
  let currentCount = countFields(best);
  if (currentCount >= TOTAL_FIELDS) {
    best.rawText = rawTexts.join("\n\n--- TESSERACT PASS ---\n\n");
    console.log(`[OCR Engine] Perfect after merge (${TOTAL_FIELDS}/${TOTAL_FIELDS}). Done in ${Math.round(performance.now() - start)}ms`);
    return { fields: best, ocrResult: bestOcrResult };
  }

  // If ONNX + Tesseract already gave us most fields, skip expensive extra passes
  if (currentCount >= TOTAL_FIELDS - 2) {
    best.rawText = rawTexts.join("\n\n---\n\n");
    console.log(`[OCR Engine] Good enough (${currentCount}/7). Done in ${Math.round(performance.now() - start)}ms`);
    return { fields: best, ocrResult: bestOcrResult };
  }

  // ---- Tesseract Pass 2: High-contrast threshold ----
  let pass2Gained = 0;
  try {
    console.log("[OCR Engine] Running Tesseract Pass 2 (high-contrast threshold)...");
    const hcBuffer = await preprocessImageHighContrast(rawImageBuffer);
    const hcOcr = await recognizeImage(hcBuffer);
    const hcFields = extractFields(hcOcr.text, hcOcr.confidence);
    const beforeMerge = countFields(best);
    mergeFields(best, hcFields);
    pass2Gained = countFields(best) - beforeMerge;
    rawTexts.push(hcOcr.text);

    console.log(`[OCR Engine] Pass 2: +${pass2Gained} new fields, total: ${countFields(best)}/7`);
  } catch (error) {
    console.error("[OCR Engine] Pass 2 failed:", error);
  }

  // Check after pass 2
  currentCount = countFields(best);
  if (currentCount >= TOTAL_FIELDS) {
    best.rawText = rawTexts.join("\n\n---\n\n");
    console.log(`[OCR Engine] Perfect after Pass 2 (${TOTAL_FIELDS}/${TOTAL_FIELDS}). Done in ${Math.round(performance.now() - start)}ms`);
    return { fields: best, ocrResult: bestOcrResult };
  }

  // Skip inversion if pass 2 gained nothing and we have decent results
  if (pass2Gained <= 0 && currentCount >= 4) {
    best.rawText = rawTexts.join("\n\n---\n\n");
    console.log(`[OCR Engine] Pass 2 gained nothing, have ${currentCount}/7. Done in ${Math.round(performance.now() - start)}ms`);
    return { fields: best, ocrResult: bestOcrResult };
  }

  // ---- Tesseract Pass 3: Color inversion (for dark backgrounds) ----
  try {
    console.log("[OCR Engine] Running Tesseract Pass 3 (color inversion)...");
    const invBuffer = await preprocessImageInverted(rawImageBuffer);
    const invOcr = await recognizeImage(invBuffer);
    const invFields = extractFields(invOcr.text, invOcr.confidence);
    const beforeMerge = countFields(best);
    mergeFields(best, invFields);
    const pass3Gained = countFields(best) - beforeMerge;
    rawTexts.push(invOcr.text);

    console.log(`[OCR Engine] Pass 3: +${pass3Gained} new fields, total: ${countFields(best)}/7`);
  } catch (error) {
    console.error("[OCR Engine] Pass 3 failed:", error);
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
