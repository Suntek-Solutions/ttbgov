/**
 * POST /api/batch
 *
 * Accepts multiple label images, runs OCR + extraction on each,
 * returns structured fields for every image.
 *
 * Request: multipart/form-data with multiple "images" file fields
 * Response: BatchResponse (see src/lib/types.ts)
 *
 * Processing strategy: parallel batches of 3 to balance throughput
 * against memory constraints (each Tesseract worker uses ~164MB).
 * Sarah's requirement: handle 200-300 labels from big importers.
 */

import { NextRequest, NextResponse } from "next/server";
import { preprocessImage } from "@/lib/ocr/preprocessor";
import { recognizeImage } from "@/lib/ocr/engine";
import { extractFields } from "@/lib/extraction/fieldExtractor";
import type { BatchResponse, ExtractedFields } from "@/lib/types";

/** Max files per batch request */
const MAX_FILES = 50;

/** Process N images concurrently */
const CONCURRENCY = 3;

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/tiff",
];

async function processImage(
  file: File
): Promise<{ filename: string; extraction: ExtractedFields | null; error?: string }> {
  try {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return {
        filename: file.name,
        extraction: null,
        error: `Unsupported file type: ${file.type}`,
      };
    }

    const arrayBuffer = await file.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    const preprocessed = await preprocessImage(imageBuffer);
    const ocrResult = await recognizeImage(preprocessed);
    const fields = extractFields(ocrResult.text, ocrResult.confidence);

    return { filename: file.name, extraction: fields };
  } catch (error) {
    return {
      filename: file.name,
      extraction: null,
      error: error instanceof Error ? error.message : "Processing failed",
    };
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<BatchResponse>> {
  const start = performance.now();

  try {
    const formData = await request.formData();
    const files = formData.getAll("images").filter((f): f is File => f instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          results: [],
          totalProcessingTimeMs: Math.round(performance.now() - start),
        },
        { status: 400 }
      );
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        {
          success: false,
          results: [],
          totalProcessingTimeMs: Math.round(performance.now() - start),
        },
        { status: 400 }
      );
    }

    // Process in parallel batches of CONCURRENCY
    const results: Array<{
      filename: string;
      extraction: ExtractedFields | null;
      error?: string;
    }> = [];

    for (let i = 0; i < files.length; i += CONCURRENCY) {
      const batch = files.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(processImage));
      results.push(...batchResults);
    }

    return NextResponse.json({
      success: true,
      results,
      totalProcessingTimeMs: Math.round(performance.now() - start),
    });
  } catch (error) {
    console.error("[/api/batch] Error:", error);
    return NextResponse.json(
      {
        success: false,
        results: [],
        totalProcessingTimeMs: Math.round(performance.now() - start),
      },
      { status: 500 }
    );
  }
}
