/**
 * Image Preprocessing Pipeline
 *
 * Prepares label images for optimal Tesseract.js OCR accuracy.
 * Addresses Jenny Park's concern about imperfect photos:
 * "labels photographed at weird angles, or the lighting is bad, or there's glare"
 *
 * Pipeline (intentionally light-touch -- aggressive processing like CLAHE
 * was tested and found to REDUCE accuracy by amplifying background noise):
 *   1. Resize to consistent width (normalize resolution for speed)
 *   2. Convert to grayscale (reduce color noise)
 *   3. Normalize (auto-levels for consistent brightness)
 *   4. Sharpen lightly (improve edge definition on slightly blurry photos)
 *
 * Diagnostic results (compliant-label.png):
 *   - Raw image: 95% confidence, 1734ms
 *   - Resize only: 95% confidence, 489ms
 *   - Gray + resize: 95% confidence, 437ms
 *   - With CLAHE: 16% confidence (DESTROYED the image)
 *
 * Usage:
 *   import { preprocessImage } from "@/lib/ocr/preprocessor";
 *   const optimized = await preprocessImage(rawImageBuffer);
 */

import sharp from "sharp";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Target width for preprocessing. Balances detail vs OCR speed. */
const TARGET_WIDTH = 1200;

/** Minimum width below which we upscale for better OCR */
const MIN_WIDTH = 600;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Preprocess a raw image buffer for optimal OCR accuracy.
 * Light-touch pipeline: resize + grayscale + normalize + gentle sharpen.
 *
 * @param imageBuffer - Raw image data (JPEG, PNG, WebP, etc.)
 * @returns Preprocessed image buffer (PNG, grayscale, normalized)
 */
export async function preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
  const start = performance.now();

  const metadata = await sharp(imageBuffer).metadata();
  const inputWidth = metadata.width ?? 0;

  let pipeline = sharp(imageBuffer);

  // Step 1: Resize to target width (maintain aspect ratio)
  if (inputWidth > TARGET_WIDTH * 1.5 || inputWidth < MIN_WIDTH) {
    pipeline = pipeline.resize(TARGET_WIDTH, null, {
      fit: "inside",
      withoutEnlargement: inputWidth >= MIN_WIDTH,
    });
  }

  // Step 2: Convert to grayscale
  pipeline = pipeline.greyscale();

  // Step 3: Normalize (auto-levels for consistent brightness)
  pipeline = pipeline.normalize();

  // Step 4: Gentle sharpen (helps slightly blurry photos without artifacts)
  pipeline = pipeline.sharpen({ sigma: 1 });

  // Output as PNG (lossless, best for OCR)
  const result = await pipeline.png().toBuffer();

  const elapsed = Math.round(performance.now() - start);
  console.log(
    `[Preprocessor] ${inputWidth}px → ${TARGET_WIDTH}px, grayscale + normalize + sharpen in ${elapsed}ms`
  );

  return result;
}

/**
 * Get basic metadata about an image without full preprocessing.
 * Useful for validation before processing.
 */
export async function getImageInfo(imageBuffer: Buffer) {
  const metadata = await sharp(imageBuffer).metadata();
  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    format: metadata.format ?? "unknown",
    sizeBytes: imageBuffer.length,
  };
}
