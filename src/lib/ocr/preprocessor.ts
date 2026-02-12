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

  if (!imageBuffer || imageBuffer.length === 0) {
    throw new Error("Empty image buffer provided to preprocessor");
  }

  let metadata;
  try {
    metadata = await sharp(imageBuffer).metadata();
  } catch (error) {
    throw new Error(
      `Failed to read image: ${error instanceof Error ? error.message : "Unsupported or corrupt image format"}`
    );
  }

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
 * Alternate preprocessing for brand-name recovery (high-contrast pass).
 *
 * The normal pipeline (resize 1200px + normalize) destroys large decorative
 * text that spans the label width. This happens because normalize() adjusts
 * brightness levels in a way that erases the contrast of oversized serif fonts.
 *
 * Diagnostic testing confirmed:
 *   - Normal pipeline (1200px + normalize):  "OLD TOM DISTILLERY" → NOT FOUND
 *   - Binary threshold (1200px + threshold): "OLD TOM DISTILLERY" → FOUND
 *   - Higher resolution (2000px + normalize): "OLD TOM DISTILLERY" → FOUND
 *   - Raw image (no preprocessing):           "OLD TOM DISTILLERY" → FOUND
 *
 * This function uses BINARY THRESHOLDING instead of normalize(). The threshold
 * creates a clean black-and-white image that preserves large decorative text
 * shapes that normalize() was destroying.
 *
 * @param imageBuffer - Raw image data (JPEG, PNG, WebP, etc.)
 * @returns High-contrast preprocessed image buffer (PNG, grayscale, thresholded)
 */
export async function preprocessImageHighContrast(imageBuffer: Buffer): Promise<Buffer> {
  const start = performance.now();

  if (!imageBuffer || imageBuffer.length === 0) {
    throw new Error("Empty image buffer provided to high-contrast preprocessor");
  }

  let metadata;
  try {
    metadata = await sharp(imageBuffer).metadata();
  } catch (error) {
    throw new Error(
      `Failed to read image: ${error instanceof Error ? error.message : "Unsupported or corrupt image format"}`
    );
  }

  const inputWidth = metadata.width ?? 0;

  let pipeline = sharp(imageBuffer);

  // Step 1: Resize (same target as normal pass)
  if (inputWidth > TARGET_WIDTH * 1.5 || inputWidth < MIN_WIDTH) {
    pipeline = pipeline.resize(TARGET_WIDTH, null, {
      fit: "inside",
      withoutEnlargement: inputWidth >= MIN_WIDTH,
    });
  }

  // Step 2: Convert to grayscale
  pipeline = pipeline.greyscale();

  // Step 3: Binary threshold (THE KEY DIFFERENCE)
  // Creates a pure black-and-white image, preserving large decorative text
  // that normalize() was destroying
  pipeline = pipeline.threshold(128);

  // Step 4: Gentle sharpen
  pipeline = pipeline.sharpen({ sigma: 1 });

  // Output as PNG (lossless, best for OCR)
  const result = await pipeline.png().toBuffer();

  const elapsed = Math.round(performance.now() - start);
  console.log(
    `[Preprocessor:HighContrast] ${inputWidth}px → ${TARGET_WIDTH}px, grayscale + threshold + sharpen in ${elapsed}ms`
  );

  return result;
}

/**
 * Color-inverted preprocessing for light-text-on-dark-background labels.
 *
 * Real COLA labels like Corte Adagio (light red text on dark gray) and
 * Casamigos (white text on black) need color inversion for Tesseract to
 * read them, since Tesseract is trained on dark-on-light text.
 *
 * Uses negate() to flip colors before the standard grayscale pipeline.
 * Uses a HIGHER target resolution (2000px vs 1200px) because inverted
 * labels often have thin/delicate fonts that need more pixels to survive
 * the negate → grayscale → normalize pipeline.
 *
 * @param imageBuffer - Raw image data (JPEG, PNG, WebP, etc.)
 * @returns Color-inverted preprocessed image buffer
 */
export async function preprocessImageInverted(imageBuffer: Buffer): Promise<Buffer> {
  const start = performance.now();

  if (!imageBuffer || imageBuffer.length === 0) {
    throw new Error("Empty image buffer provided to inverted preprocessor");
  }

  let metadata;
  try {
    metadata = await sharp(imageBuffer).metadata();
  } catch (error) {
    throw new Error(
      `Failed to read image: ${error instanceof Error ? error.message : "Unsupported or corrupt image format"}`
    );
  }

  const inputWidth = metadata.width ?? 0;

  // Higher resolution for inverted pass -- thin fonts on dark backgrounds
  // need more pixels to remain legible after color inversion + normalize
  const INVERTED_TARGET = 2000;

  let pipeline = sharp(imageBuffer);

  // Step 1: Resize to higher target (preserves thin/delicate text)
  if (inputWidth > INVERTED_TARGET * 1.5 || inputWidth < MIN_WIDTH) {
    pipeline = pipeline.resize(INVERTED_TARGET, null, {
      fit: "inside",
      withoutEnlargement: inputWidth >= MIN_WIDTH,
    });
  }

  // Step 2: Negate (invert colors -- light-on-dark becomes dark-on-light)
  pipeline = pipeline.negate({ alpha: false });

  // Step 3: Grayscale
  pipeline = pipeline.greyscale();

  // Step 4: Normalize (safe after inversion since text is now dark-on-light)
  pipeline = pipeline.normalize();

  // Step 5: Gentle sharpen
  pipeline = pipeline.sharpen({ sigma: 1 });

  const result = await pipeline.png().toBuffer();

  const elapsed = Math.round(performance.now() - start);
  console.log(
    `[Preprocessor:Inverted] ${inputWidth}px → ${INVERTED_TARGET}px, negate + grayscale + normalize + sharpen in ${elapsed}ms`
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
