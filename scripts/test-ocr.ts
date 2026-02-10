/**
 * OCR Validation Script
 *
 * Tests the Tesseract.js OCR engine + sharp preprocessing pipeline
 * against our generated test labels to validate:
 *   - Risk #1: Tesseract OCR accuracy on label images
 *   - Assumption A1: Acceptable accuracy with preprocessing
 *   - Assumption A2: 1-3 second processing time
 *
 * Run: npx tsx scripts/test-ocr.ts
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { preprocessImage } from "../src/lib/ocr/preprocessor";
import { recognizeImage, terminateEngine } from "../src/lib/ocr/engine";

const TEST_LABELS_DIR = join(process.cwd(), "public", "test-labels", "generated");

async function main() {
  console.log("=".repeat(70));
  console.log("TTB Label Verification -- OCR Validation Test");
  console.log("=".repeat(70));
  console.log();

  const files = readdirSync(TEST_LABELS_DIR).filter((f) =>
    /\.(png|jpg|jpeg|webp)$/i.test(f)
  );

  if (files.length === 0) {
    console.error("No test label images found in", TEST_LABELS_DIR);
    process.exit(1);
  }

  console.log(`Found ${files.length} test labels in ${TEST_LABELS_DIR}`);
  console.log();

  const results: Array<{
    file: string;
    confidence: number;
    processingMs: number;
    textLength: number;
    textPreview: string;
  }> = [];

  for (const file of files) {
    console.log("-".repeat(70));
    console.log(`Testing: ${file}`);
    console.log("-".repeat(70));

    const imagePath = join(TEST_LABELS_DIR, file);
    const rawBuffer = readFileSync(imagePath);

    // Step 1: Preprocess
    console.log("  Preprocessing...");
    const preprocessStart = performance.now();
    const preprocessed = await preprocessImage(rawBuffer);
    const preprocessMs = Math.round(performance.now() - preprocessStart);
    console.log(`  Preprocessed in ${preprocessMs}ms (${rawBuffer.length} → ${preprocessed.length} bytes)`);

    // Step 2: OCR
    console.log("  Running OCR...");
    const ocrResult = await recognizeImage(preprocessed);

    console.log(`  Confidence: ${ocrResult.confidence}%`);
    console.log(`  Processing time: ${ocrResult.processingTimeMs}ms`);
    console.log(`  Total time: ${preprocessMs + ocrResult.processingTimeMs}ms`);
    console.log(`  Text length: ${ocrResult.text.length} chars`);
    console.log();
    console.log("  --- Extracted Text ---");
    console.log(ocrResult.text.split("\n").map((l) => `  | ${l}`).join("\n"));
    console.log("  --- End Text ---");
    console.log();

    results.push({
      file,
      confidence: ocrResult.confidence,
      processingMs: preprocessMs + ocrResult.processingTimeMs,
      textLength: ocrResult.text.length,
      textPreview: ocrResult.text.substring(0, 100).replace(/\n/g, " "),
    });
  }

  // Summary
  console.log("=".repeat(70));
  console.log("SUMMARY");
  console.log("=".repeat(70));
  console.log();

  const avgConfidence =
    results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  const avgProcessing =
    results.reduce((sum, r) => sum + r.processingMs, 0) / results.length;
  const maxProcessing = Math.max(...results.map((r) => r.processingMs));

  for (const r of results) {
    const status =
      r.confidence >= 70
        ? "PASS"
        : r.confidence >= 50
        ? "WARN"
        : "FAIL";
    console.log(
      `  [${status}] ${r.file.padEnd(30)} confidence: ${r.confidence}%  time: ${r.processingMs}ms`
    );
  }

  console.log();
  console.log(`  Average confidence: ${avgConfidence.toFixed(1)}%`);
  console.log(`  Average processing: ${avgProcessing.toFixed(0)}ms`);
  console.log(`  Max processing:     ${maxProcessing}ms`);
  console.log();

  // Risk validation
  console.log("=".repeat(70));
  console.log("RISK VALIDATION");
  console.log("=".repeat(70));
  console.log();

  const accuracyPass = avgConfidence >= 60;
  const performancePass = maxProcessing <= 5000;

  console.log(
    `  Risk #1 (OCR accuracy):    ${accuracyPass ? "VALIDATED" : "NEEDS PIVOT"} -- avg confidence ${avgConfidence.toFixed(1)}% (threshold: 60%)`
  );
  console.log(
    `  Assumption A2 (performance): ${performancePass ? "VALIDATED" : "NEEDS PIVOT"} -- max ${maxProcessing}ms (threshold: 5000ms)`
  );
  console.log();

  await terminateEngine();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
