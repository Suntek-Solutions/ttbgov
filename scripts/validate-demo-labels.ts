/**
 * Validate every demo label in demo-labels.json
 * 
 * For each label:
 * 1. Extract via API
 * 2. Verify with the JSON's applicationData
 * 3. Report results
 * 
 * Run: npx tsx scripts/validate-demo-labels.ts
 */

import { readFileSync } from "fs";
import { join } from "path";

const BASE_URL = "http://localhost:3000";

interface DemoLabel {
  id: string;
  name: string;
  description: string;
  category: string;
  file: string;
  expectedResult?: string;
  applicationData: Record<string, string>;
}

async function main() {
  const labelsJson = readFileSync(
    join(process.cwd(), "public", "test-labels", "demo-labels.json"),
    "utf-8"
  );
  const labels: DemoLabel[] = JSON.parse(labelsJson);

  console.log("=".repeat(70));
  console.log(`Validating ${labels.length} demo labels`);
  console.log("=".repeat(70));
  console.log();

  for (const label of labels) {
    console.log(`--- ${label.name} (${label.category}) ---`);
    console.log(`  File: ${label.file}`);
    console.log(`  Expected: ${label.expectedResult ?? "n/a"}`);

    // Resolve file path
    const filePath = join(process.cwd(), "public", label.file.replace(/^\//, ""));
    let fileBuffer: Buffer;
    try {
      fileBuffer = readFileSync(filePath);
    } catch {
      console.log(`  ERROR: File not found at ${filePath}`);
      console.log();
      continue;
    }
    console.log(`  File size: ${(fileBuffer.length / 1024).toFixed(0)}KB`);

    // Extract
    const blob = new Blob([fileBuffer], { type: "image/png" });
    const formData = new FormData();
    formData.append("image", blob, filePath.split(/[/\\]/).pop()!);

    const extractRes = await fetch(`${BASE_URL}/api/extract`, {
      method: "POST",
      body: formData,
    });
    const extractData = await extractRes.json();

    if (!extractData.success) {
      console.log(`  EXTRACT FAILED: ${extractData.error}`);
      console.log();
      continue;
    }

    const fields = extractData.fields;
    console.log(`  OCR (${extractData.processingTimeMs}ms):`);
    console.log(`    Brand:   ${fields.brandName.value ?? "(not found)"} [${Math.round(fields.brandName.confidence * 100)}%]`);
    console.log(`    Type:    ${fields.classType.value ?? "(not found)"} [${Math.round(fields.classType.confidence * 100)}%]`);
    console.log(`    ABV:     ${fields.alcoholContent.value ?? "(not found)"} [${Math.round(fields.alcoholContent.confidence * 100)}%]`);
    console.log(`    Volume:  ${fields.netContents.value ?? "(not found)"} [${Math.round(fields.netContents.confidence * 100)}%]`);
    console.log(`    Warning: ${fields.governmentWarning.value ? "FOUND" : "NOT FOUND"} [${Math.round(fields.governmentWarning.confidence * 100)}%]`);
    console.log(`    Producer:${fields.producerInfo.value ?? "(not found)"} [${Math.round(fields.producerInfo.confidence * 100)}%]`);
    console.log(`    Origin:  ${fields.countryOfOrigin.value ?? "(not found)"} [${Math.round(fields.countryOfOrigin.confidence * 100)}%]`);

    // Verify
    const verifyRes = await fetch(`${BASE_URL}/api/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        extracted: fields,
        application: label.applicationData,
      }),
    });
    const verifyData = await verifyRes.json();

    if (!verifyData.success) {
      console.log(`  VERIFY FAILED: ${verifyData.error}`);
      console.log();
      continue;
    }

    console.log(`  Verify: ${verifyData.overall.toUpperCase()} (${verifyData.processingTimeMs}ms)`);
    for (const r of verifyData.results) {
      console.log(`    [${r.match ? "PASS" : "FAIL"}] ${r.field}: ${r.details}`);
    }
    console.log();
  }
}

main().catch(console.error);
