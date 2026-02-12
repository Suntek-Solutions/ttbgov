/**
 * ONNX OCR Engine (via multilingual-purejs-ocr)
 *
 * High-accuracy local OCR based on PaddleOCR PP-OCRv4 models running via
 * ONNX Runtime in pure JavaScript. No Python, no cloud APIs required.
 *
 * Dramatically better than Tesseract.js on:
 *   - Dark backgrounds (Casamigos, Corte Adagio)
 *   - Decorative fonts (brand names)
 *   - Complex label layouts (Barrilito, South Bank)
 *   - Speed: 0.5-2s per label (faster than Tesseract multi-pass)
 *
 * Built-in paragraph grouping produces clean, properly-spaced text
 * that works directly with our regex-based field extraction.
 *
 * 100% local processing -- zero API calls, zero cloud dependency.
 * Works behind any firewall (Marcus Williams's constraint).
 */

import { join } from "path";
import { writeFileSync, unlinkSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import type { OcrResult } from "@/lib/types";

// ---------------------------------------------------------------------------
// Singleton Instance
// ---------------------------------------------------------------------------

let ocrInstance: any = null;
let initPromise: Promise<void> | null = null;
let tempDir: string | null = null;

/**
 * Initialize the ONNX OCR engine. Called automatically on first use.
 */
async function ensureInitialized(): Promise<any> {
  if (ocrInstance) return ocrInstance;

  if (!initPromise) {
    initPromise = (async () => {
      try {
        console.log("[ONNX OCR] Initializing PP-OCRv4 engine...");
        const start = performance.now();

        const OcrModule = await import("multilingual-purejs-ocr");
        const Ocr = OcrModule.default;

        // Model paths within node_modules
        const modelsDir = join(
          process.cwd(),
          "node_modules",
          "multilingual-purejs-ocr",
          "models"
        );

        ocrInstance = await Ocr.create({
          language: "en",
          // Tuned for alcohol label detection
          detectionThreshold: 0.05, // More sensitive (catch small/faint text)
          confidenceThreshold: 0.3, // Accept moderate confidence
          unclipRatio: 1.8, // Better text region capture
          maxImageSize: 1280, // Balance quality vs speed
          // Model paths
          detectionModelPath: join(modelsDir, "ch_PP-OCRv4_det_infer.onnx"),
          recognitionModelPath: join(modelsDir, "en_PP-OCRv4_rec_infer.onnx"),
          dictionaryPath: join(modelsDir, "en_dict.txt"),
          // ONNX performance tuning
          detectionOnnxOptions: {
            executionProviders: ["cpu"],
            intraOpNumThreads: 4,
            graphOptimizationLevel: "all",
            enableCpuMemArena: true,
          },
          recognitionOnnxOptions: {
            executionProviders: ["cpu"],
            intraOpNumThreads: 2,
            executionMode: "sequential",
          },
        });

        // Create a persistent temp directory for image files
        tempDir = mkdtempSync(join(tmpdir(), "ttb-ocr-"));

        const elapsed = Math.round(performance.now() - start);
        console.log(`[ONNX OCR] Ready in ${elapsed}ms`);
      } catch (error) {
        initPromise = null;
        console.error("[ONNX OCR] Failed to initialize:", error);
        throw new Error(
          `ONNX OCR initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    })();
  }

  await initPromise;
  return ocrInstance;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run ONNX OCR on an image buffer and return extracted text.
 *
 * The library's built-in paragraph grouping produces clean, properly-spaced
 * text blocks -- significantly better than raw region concatenation.
 *
 * @param imageBuffer - Raw image data (JPEG, PNG, WebP, etc.)
 * @returns OcrResult with paragraph-grouped text, confidence, and time
 */
export async function recognizeWithOnnx(imageBuffer: Buffer): Promise<OcrResult> {
  const start = performance.now();

  const ocr = await ensureInitialized();

  // The library requires a file path -- write buffer to temp file
  const tmpFile = join(tempDir!, `label-${Date.now()}.jpg`);
  try {
    writeFileSync(tmpFile, imageBuffer);

    const result = await ocr.detect(tmpFile);

    if (!result || !result.data || result.data.length === 0) {
      return {
        text: "",
        confidence: 0,
        processingTimeMs: Math.round(performance.now() - start),
      };
    }

    // Use paragraph-grouped text (clean, properly spaced)
    let fullText: string;
    if (result.paragraphs && result.paragraphs.length > 0) {
      fullText = result.paragraphs
        .map((p: { text: string }) => p.text)
        .join("\n");
    } else {
      // Fallback to raw elements
      fullText = result.data
        .map((d: { text: string }) => d.text)
        .join("\n");
    }

    // Average confidence across all detected elements
    const avgConfidence = Math.round(
      (result.data.reduce(
        (sum: number, d: { confidence: number }) => sum + d.confidence,
        0
      ) / result.data.length) * 100
    );

    const processingTimeMs = Math.round(performance.now() - start);

    console.log(
      `[ONNX OCR] ${result.totalElements} elements, ${result.totalParagraphs} paragraphs, ` +
      `${fullText.length} chars, confidence: ${avgConfidence}%, time: ${processingTimeMs}ms`
    );

    return {
      text: fullText,
      confidence: avgConfidence,
      processingTimeMs,
    };
  } finally {
    // Clean up temp file
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

/**
 * Check if ONNX OCR is available (models present, ONNX runtime works).
 * Returns false if initialization fails -- caller can fall back to Tesseract.
 */
export async function isOnnxAvailable(): Promise<boolean> {
  try {
    await ensureInitialized();
    return true;
  } catch {
    return false;
  }
}
