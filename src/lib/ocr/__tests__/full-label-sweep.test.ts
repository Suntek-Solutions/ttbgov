/**
 * Full Label Sweep Test
 * 
 * Comprehensive test that processes ALL labels in public/test-labels/,
 * validates against demo-labels.json, and provides detailed recommendations
 * for OCR improvements.
 * 
 * Run with: npm test -- full-label-sweep
 */

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, relative, extname } from "path";
import { preprocessImage } from "@/lib/ocr/preprocessor";
import { recognizeWithFallback } from "@/lib/ocr/engine";
import type { ExtractedFields, FieldResult } from "@/lib/types";
import { describe, it, expect, afterAll } from "vitest";

const BASE = join(process.cwd(), "public", "test-labels");
const DEMO_JSON_PATH = join(BASE, "demo-labels.json");

interface DemoLabel {
  id: string;
  name: string;
  file: string;
  category: string;
  featured?: boolean;
  applicationData?: Record<string, string>;
  expectedResult?: string;
}

interface LabelResult {
  file: string;
  category: string;
  brand: string;
  classType: string;
  abv: string;
  net: string;
  warning: string;
  producer: string;
  origin: string;
  fieldsFound: number;
  timeMs: number;
  warningCapsOk: boolean | null;
  inDemoJson: boolean;
  error?: string;
}

// Helper: recursively find all image files
function findImages(dir: string): string[] {
  const images: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      images.push(...findImages(fullPath));
    } else if (/\.(jpg|jpeg|png|webp)$/i.test(entry)) {
      images.push(fullPath);
    }
  }

  return images;
}

// Helper: count fields found
function countFields(fields: ExtractedFields): number {
  let count = 0;
  if (fields.brandName?.value) count++;
  if (fields.classType?.value) count++;
  if (fields.alcoholContent?.value) count++;
  if (fields.netContents?.value) count++;
  if (fields.governmentWarning?.value) count++;
  if (fields.producerInfo?.value) count++;
  if (fields.countryOfOrigin?.value) count++;
  return count;
}

// Helper: get field value for display
function fieldVal(field: FieldResult | undefined): string {
  if (!field?.value) return "---";
  const val = field.value.substring(0, 20);
  return val.length < field.value.length ? `${val}...` : val;
}

// Load demo-labels.json
let demoLabels: DemoLabel[] = [];
try {
  const raw = readFileSync(DEMO_JSON_PATH, "utf-8");
  demoLabels = JSON.parse(raw);
} catch (e) {
  console.warn(`⚠️  Could not load demo-labels.json: ${e}`);
}

describe("Full Label Sweep (all labels + demo-labels.json validation)", () => {
  const allImages = findImages(BASE).filter(
    (p) => !p.includes("demo-labels.json") && !p.includes(".gitkeep")
  );
  const results: LabelResult[] = [];

  console.log(`\n🔍 Discovered ${allImages.length} labels in ${BASE}\n`);

  // Process each label
  for (const imgPath of allImages) {
    const relPath = relative(BASE, imgPath).replace(/\\/g, "/");
    const shortName = relPath.split("/").pop()!;
    const category = relPath.startsWith("generated")
      ? "generated"
      : relPath.startsWith("real")
      ? "real"
      : "other";

    // Check if this image is in demo-labels.json
    const inDemoJson = demoLabels.some(
      (label) => label.file === `/test-labels/${relPath}`
    );

    it(`processes ${relPath}`, async () => {
      const start = performance.now();

      try {
        const raw = readFileSync(imgPath);
        const preprocessed = await preprocessImage(raw);
        const { fields } = await recognizeWithFallback(preprocessed, raw);
        const timeMs = Math.round(performance.now() - start);

        const warningText = fields.governmentWarning?.value;
        const warningCapsOk = warningText
          ? /^GOVERNMENT\s+WARNING\s*:/.test(warningText)
          : null;

        const result: LabelResult = {
          file: shortName,
          category,
          brand: fieldVal(fields.brandName),
          classType: fieldVal(fields.classType),
          abv: fieldVal(fields.alcoholContent),
          net: fieldVal(fields.netContents),
          warning: warningText ? "Found" : "---",
          producer: fieldVal(fields.producerInfo),
          origin: fieldVal(fields.countryOfOrigin),
          fieldsFound: countFields(fields),
          timeMs,
          warningCapsOk,
          inDemoJson,
        };

        results.push(result);

        // Assertions
        expect(timeMs).toBeLessThan(10000); // Must complete within 10s (spec says ~5s)
        expect(fields).toBeDefined();
        expect(fields.brandName).toBeDefined(); // Brand is critical
        if (warningText) {
          expect(warningCapsOk).toBe(true); // Gov warning must have correct caps with colon
        }
      } catch (e) {
        const timeMs = Math.round(performance.now() - start);
        results.push({
          file: shortName,
          category,
          brand: "ERROR",
          classType: "---",
          abv: "---",
          net: "---",
          warning: "---",
          producer: "---",
          origin: "---",
          fieldsFound: 0,
          timeMs,
          warningCapsOk: null,
          inDemoJson,
          error: String(e),
        });
        throw e; // Re-throw to fail the test
      }
    }, 15000); // 15s timeout per label (reasonable buffer over 10s SLA)
  }

  // After all tests, print comprehensive report
  afterAll(() => {
    console.log("\n" + "=".repeat(120));
    console.log("📊 FULL LABEL SWEEP REPORT");
    console.log("=".repeat(120) + "\n");

    // Summary stats
    const totalLabels = results.length;
    const successfulLabels = results.filter((r) => !r.error).length;
    const avgTime =
      results.reduce((sum, r) => sum + r.timeMs, 0) / totalLabels;
    const slowLabels = results.filter((r) => r.timeMs > 5000);
    const missingInJson = results.filter((r) => !r.inDemoJson);

    console.log("📋 SUMMARY");
    console.log("-".repeat(120));
    console.log(`Total Labels:           ${totalLabels}`);
    console.log(
      `Successful:             ${successfulLabels} (${Math.round((successfulLabels / totalLabels) * 100)}%)`
    );
    console.log(`Failed:                 ${totalLabels - successfulLabels}`);
    console.log(`Average Processing:     ${Math.round(avgTime)}ms`);
    console.log(`Labels > 5s SLA:        ${slowLabels.length}`);
    console.log(
      `Missing in demo.json:   ${missingInJson.length} ⚠️${missingInJson.length > 0 ? " ACTION NEEDED" : ""}`
    );
    console.log("");

    // Breakdown by category
    const genResults = results.filter((r) => r.category === "generated");
    const realResults = results.filter((r) => r.category === "real");

    console.log("📊 GENERATED LABELS");
    console.log("-".repeat(120));
    printCategoryStats(genResults);
    console.log("");

    console.log("📊 REAL COLA LABELS");
    console.log("-".repeat(120));
    printCategoryStats(realResults);
    console.log("");

    // Detailed results table
    console.log("📋 DETAILED RESULTS (all labels)");
    console.log("-".repeat(120));
    console.log(
      "File".padEnd(35) +
        "Cat".padEnd(10) +
        "Brand".padEnd(22) +
        "Class".padEnd(15) +
        "ABV".padEnd(10) +
        "Net".padEnd(10) +
        "Warn".padEnd(8) +
        "Flds".padEnd(6) +
        "Time".padEnd(8) +
        "JSON"
    );
    console.log("-".repeat(120));

    for (const r of results) {
      const file = (r.file.length > 33 ? r.file.substring(0, 30) + "..." : r.file).padEnd(35);
      const cat = r.category.padEnd(10);
      const brand = r.brand.padEnd(22);
      const cls = r.classType.padEnd(15);
      const abv = r.abv.padEnd(10);
      const net = r.net.padEnd(10);
      const warn = r.warning.padEnd(8);
      const flds = `${r.fieldsFound}/7`.padEnd(6);
      const time = `${r.timeMs}ms`.padEnd(8);
      const json = r.inDemoJson ? "✓" : "✗";

      console.log(file + cat + brand + cls + abv + net + warn + flds + time + json);

      if (r.error) {
        console.log(`  ERROR: ${r.error}`);
      }
    }

    console.log("");

    // Missing in demo-labels.json
    if (missingInJson.length > 0) {
      console.log("⚠️  LABELS MISSING IN demo-labels.json");
      console.log("-".repeat(120));
      for (const r of missingInJson) {
        console.log(`  - ${r.file} (${r.category})`);
      }
      console.log("");
    }

    // Recommendations
    console.log("💡 RECOMMENDATIONS");
    console.log("-".repeat(120));
    generateRecommendations(results);
    console.log("");

    console.log("=".repeat(120));
  });
});

function printCategoryStats(results: LabelResult[]) {
  if (results.length === 0) {
    console.log("  No labels in this category.");
    return;
  }

  const total = results.length;
  const avgFields =
    results.reduce((sum, r) => sum + r.fieldsFound, 0) / total;
  const avgTime = results.reduce((sum, r) => sum + r.timeMs, 0) / total;

  const brandDetection = results.filter((r) => r.brand !== "---").length;
  const classDetection = results.filter((r) => r.classType !== "---").length;
  const abvDetection = results.filter((r) => r.abv !== "---").length;
  const netDetection = results.filter((r) => r.net !== "---").length;
  const warningDetection = results.filter((r) => r.warning === "Found").length;
  const producerDetection = results.filter((r) => r.producer !== "---").length;
  const originDetection = results.filter((r) => r.origin !== "---").length;

  const warningCapsCorrect = results.filter((r) => r.warningCapsOk === true).length;
  const warningCapsIncorrect = results.filter((r) => r.warningCapsOk === false).length;

  console.log(`  Total:              ${total}`);
  console.log(`  Avg Fields:         ${avgFields.toFixed(1)}/7`);
  console.log(`  Avg Processing:     ${Math.round(avgTime)}ms`);
  console.log("");
  console.log("  Field Detection Rates:");
  console.log(`    Brand Name:       ${brandDetection}/${total} (${Math.round((brandDetection / total) * 100)}%)`);
  console.log(`    Class/Type:       ${classDetection}/${total} (${Math.round((classDetection / total) * 100)}%)`);
  console.log(`    ABV:              ${abvDetection}/${total} (${Math.round((abvDetection / total) * 100)}%)`);
  console.log(`    Net Contents:     ${netDetection}/${total} (${Math.round((netDetection / total) * 100)}%)`);
  console.log(`    Gov Warning:      ${warningDetection}/${total} (${Math.round((warningDetection / total) * 100)}%)`);
  console.log(`    Producer:         ${producerDetection}/${total} (${Math.round((producerDetection / total) * 100)}%)`);
  console.log(`    Origin:           ${originDetection}/${total} (${Math.round((originDetection / total) * 100)}%)`);
  console.log("");
  console.log(`  Gov Warning Caps:   ${warningCapsCorrect} correct, ${warningCapsIncorrect} incorrect`);
}

function generateRecommendations(results: LabelResult[]) {
  const realResults = results.filter((r) => r.category === "real");
  const genResults = results.filter((r) => r.category === "generated");

  // Issue 1: Missing in demo-labels.json
  const missingInJson = results.filter((r) => !r.inDemoJson);
  if (missingInJson.length > 0) {
    console.log(`  🔴 HIGH: ${missingInJson.length} labels are missing from demo-labels.json`);
    console.log(`     Action: Run 'npm run generate-demo-labels' to regenerate the catalog.`);
    console.log("");
  }

  // Issue 2: Low field detection on real COLA labels
  const realAvgFields = realResults.length > 0
    ? realResults.reduce((sum, r) => sum + r.fieldsFound, 0) / realResults.length
    : 0;

  if (realAvgFields < 5) {
    console.log(`  🔴 HIGH: Real COLA labels averaging only ${realAvgFields.toFixed(1)}/7 fields`);
    console.log(`     Real labels are the gold standard for TTB evaluation.`);
    console.log(`     Action: Investigate OCR preprocessing and pattern extraction for real labels.`);
    console.log("");
  } else if (realAvgFields < 6) {
    console.log(`  🟡 MEDIUM: Real COLA labels averaging ${realAvgFields.toFixed(1)}/7 fields`);
    console.log(`     Room for improvement to reach 6-7 fields consistently.`);
    console.log(`     Action: Review pattern extraction for missing fields (likely origin/producer).`);
    console.log("");
  }

  // Issue 3: Performance concerns
  const slowLabels = results.filter((r) => r.timeMs > 5000);
  if (slowLabels.length > results.length * 0.2) {
    console.log(`  🟡 MEDIUM: ${slowLabels.length}/${results.length} labels exceed 5s SLA`);
    console.log(`     Action: Consider caching ONNX model initialization or optimizing preprocessing.`);
    console.log("");
  }

  // Issue 4: Government warning capitalization
  const warningCapsIncorrect = results.filter((r) => r.warningCapsOk === false);
  if (warningCapsIncorrect.length > 0) {
    console.log(`  🟡 MEDIUM: ${warningCapsIncorrect.length} labels have incorrect gov warning caps`);
    console.log(`     Action: Ensure case-sensitive field merge logic is working correctly.`);
    console.log("");
  }

  // Issue 5: Specific field weaknesses
  const brandDetection = results.filter((r) => r.brand !== "---").length / results.length;
  const originDetection = results.filter((r) => r.origin !== "---").length / results.length;

  if (brandDetection < 0.9) {
    console.log(`  🟡 MEDIUM: Brand name detection at ${Math.round(brandDetection * 100)}%`);
    console.log(`     Action: Review multi-pass OCR for decorative fonts and color inversion.`);
    console.log("");
  }

  if (originDetection < 0.7) {
    console.log(`  🟡 MEDIUM: Origin detection at ${Math.round(originDetection * 100)}%`);
    console.log(`     Action: Expand ORIGIN_PATTERN and PRODUCER_PATTERN keywords.`);
    console.log("");
  }

  // Success message
  if (
    missingInJson.length === 0 &&
    realAvgFields >= 6 &&
    slowLabels.length === 0 &&
    warningCapsIncorrect.length === 0 &&
    brandDetection >= 0.9 &&
    originDetection >= 0.7
  ) {
    console.log(`  ✅ All systems nominal! OCR pipeline is performing well across all labels.`);
    console.log(`     Real COLA detection: ${realAvgFields.toFixed(1)}/7 avg fields`);
    console.log(`     Performance: ${results.reduce((sum, r) => sum + r.timeMs, 0) / results.length}ms avg`);
    console.log("");
  }
}
