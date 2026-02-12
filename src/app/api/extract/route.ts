/**
 * POST /api/extract
 *
 * Accepts a label image upload, runs OCR, and returns structured fields.
 *
 * Request: multipart/form-data with "image" file field
 * Response: ExtractResponse (see src/lib/types.ts)
 */

import { NextRequest, NextResponse } from "next/server";
import { preprocessImage } from "@/lib/ocr/preprocessor";
import { recognizeWithFallback } from "@/lib/ocr/engine";
import type { ExtractResponse } from "@/lib/types";

/** Max file size: 10MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Accepted image MIME types */
const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/tiff",
];

export async function POST(request: NextRequest): Promise<NextResponse<ExtractResponse>> {
  const start = performance.now();

  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("image");

    // Validate file presence
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "No image file provided. Send a file with field name 'image'.",
          processingTimeMs: Math.round(performance.now() - start),
        },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type: ${file.type}. Accepted: JPEG, PNG, WebP, GIF, TIFF.`,
          processingTimeMs: Math.round(performance.now() - start),
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum: 10MB.`,
          processingTimeMs: Math.round(performance.now() - start),
        },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    console.log(`[/api/extract] Received: ${file.name}, type: ${file.type}, size: ${(file.size / 1024).toFixed(0)}KB, buffer: ${imageBuffer.length} bytes`);

    // Preprocess image (normal pass)
    const preprocessed = await preprocessImage(imageBuffer);

    // Run multi-pass OCR (normal → inverted fallback if brand missing)
    const { fields } = await recognizeWithFallback(preprocessed, imageBuffer);

    const processingTimeMs = Math.round(performance.now() - start);

    return NextResponse.json({
      success: true,
      fields,
      processingTimeMs,
    });
  } catch (error) {
    console.error("[/api/extract] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred during extraction.",
        processingTimeMs: Math.round(performance.now() - start),
      },
      { status: 500 }
    );
  }
}
