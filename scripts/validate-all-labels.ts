/**
 * Full validation of ALL 59 demo labels.
 * Extracts via API, verifies with applicationData, tests batch.
 * 
 * Run: npx tsx scripts/validate-all-labels.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const BASE_URL = "http://localhost:3000";

interface DemoLabel {
  id: string;
  name: string;
  description: string;
  category: string;
  file: string;
  applicationData: Record<string, string>;
}

interface Result {
  id: string;
  name: string;
  category: string;
  fileSize: string;
  extractSuccess: boolean;
  extractTimeMs: number;
  ocrConfidence: string;
  fieldsFound: number;
  verifyOverall: string;
  fieldResults: string[];
  issues: string[];
}

async function extractLabel(filePath: string): Promise<any> {
  const buf = readFileSync(filePath);
  const blob = new Blob([buf], { type: "image/png" });
  const form = new FormData();
  form.append("image", blob, filePath.split(/[/\\]/).pop()!);
  const res = await fetch(`${BASE_URL}/api/extract`, { method: "POST", body: form });
  return res.json();
}

async function verifyLabel(fields: any, appData: Record<string, string>): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ extracted: fields, application: appData }),
  });
  return res.json();
}

async function batchExtract(filePaths: string[]): Promise<any> {
  const form = new FormData();
  for (const fp of filePaths) {
    const buf = readFileSync(fp);
    const blob = new Blob([buf], { type: "image/png" });
    form.append("images", blob, fp.split(/[/\\]/).pop()!);
  }
  const res = await fetch(`${BASE_URL}/api/batch`, { method: "POST", body: form });
  return res.json();
}

async function main() {
  const labels: DemoLabel[] = JSON.parse(
    readFileSync(join(process.cwd(), "public", "test-labels", "demo-labels.json"), "utf-8")
  );

  console.log("=".repeat(70));
  console.log(`FULL VALIDATION: ${labels.length} labels`);
  console.log("=".repeat(70));
  console.log();

  const results: Result[] = [];
  let passCount = 0;
  let failCount = 0;
  let extractFailCount = 0;

  // --- SINGLE LABEL TESTS ---
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const filePath = join(process.cwd(), "public", label.file.replace(/^\//, ""));
    
    let fileSize: string;
    try {
      const buf = readFileSync(filePath);
      fileSize = (buf.length / 1024).toFixed(0) + "KB";
    } catch {
      console.log(`[${i + 1}/${labels.length}] ${label.name} -- FILE NOT FOUND`);
      results.push({
        id: label.id, name: label.name, category: label.category,
        fileSize: "N/A", extractSuccess: false, extractTimeMs: 0,
        ocrConfidence: "0%", fieldsFound: 0, verifyOverall: "error",
        fieldResults: [], issues: ["File not found: " + filePath]
      });
      extractFailCount++;
      continue;
    }

    // Extract
    const ext = await extractLabel(filePath);
    if (!ext.success) {
      console.log(`[${i + 1}/${labels.length}] ${label.name} -- EXTRACT FAILED: ${ext.error}`);
      results.push({
        id: label.id, name: label.name, category: label.category,
        fileSize, extractSuccess: false, extractTimeMs: ext.processingTimeMs || 0,
        ocrConfidence: "0%", fieldsFound: 0, verifyOverall: "error",
        fieldResults: [], issues: ["Extract failed: " + (ext.error || "unknown")]
      });
      extractFailCount++;
      continue;
    }

    const fields = ext.fields;
    const fieldsFound = Object.entries(fields)
      .filter(([k, v]) => k !== "rawText" && (v as any).value)
      .length;

    // Verify
    const ver = await verifyLabel(fields, label.applicationData);
    const fieldResults: string[] = [];
    const issues: string[] = [];

    if (ver.success && ver.results) {
      for (const r of ver.results) {
        const icon = r.match ? "PASS" : "FAIL";
        fieldResults.push(`${icon} ${r.field}`);
        if (!r.match) issues.push(`${r.field}: ${r.details}`);
      }
      if (ver.overall === "pass") passCount++;
      else failCount++;
    }

    const status = ver.overall === "pass" ? "PASS" : "FAIL";
    const passFields = ver.results?.filter((r: any) => r.match).length ?? 0;
    const totalFields = ver.results?.length ?? 0;

    console.log(
      `[${i + 1}/${labels.length}] ${label.name.padEnd(45)} ${status} (${passFields}/${totalFields}) ${ext.processingTimeMs}ms ${fileSize}`
    );

    results.push({
      id: label.id, name: label.name, category: label.category,
      fileSize, extractSuccess: true, extractTimeMs: ext.processingTimeMs,
      ocrConfidence: Math.round((fields.classType?.confidence ?? 0) * 100) + "%",
      fieldsFound, verifyOverall: ver.overall || "error",
      fieldResults, issues
    });
  }

  // --- BATCH TEST ---
  console.log();
  console.log("=".repeat(70));
  console.log("BATCH TEST");
  console.log("=".repeat(70));

  // Test batch with generated labels (5)
  const generatedPaths = labels
    .filter((l) => l.category === "generated")
    .map((l) => join(process.cwd(), "public", l.file.replace(/^\//, "")));

  console.log(`Batch extracting ${generatedPaths.length} generated labels...`);
  const batchGenResult = await batchExtract(generatedPaths);
  console.log(`  Success: ${batchGenResult.success}`);
  console.log(`  Results: ${batchGenResult.results?.length ?? 0} / ${generatedPaths.length}`);
  console.log(`  Time: ${batchGenResult.totalProcessingTimeMs}ms`);
  const batchGenSuccess = batchGenResult.results?.filter((r: any) => r.extraction).length ?? 0;
  console.log(`  Extracted: ${batchGenSuccess} / ${generatedPaths.length}`);

  // Test batch with a sample of real labels (10)
  const realSample = labels
    .filter((l) => l.category === "real")
    .slice(0, 10)
    .map((l) => join(process.cwd(), "public", l.file.replace(/^\//, "")));

  console.log(`\nBatch extracting ${realSample.length} real labels (sample)...`);
  const batchRealResult = await batchExtract(realSample);
  console.log(`  Success: ${batchRealResult.success}`);
  console.log(`  Results: ${batchRealResult.results?.length ?? 0} / ${realSample.length}`);
  console.log(`  Time: ${batchRealResult.totalProcessingTimeMs}ms`);
  const batchRealSuccess = batchRealResult.results?.filter((r: any) => r.extraction).length ?? 0;
  console.log(`  Extracted: ${batchRealSuccess} / ${realSample.length}`);

  // --- SUMMARY ---
  console.log();
  console.log("=".repeat(70));
  console.log("SUMMARY");
  console.log("=".repeat(70));
  console.log();

  const generated = results.filter((r) => r.category === "generated");
  const real = results.filter((r) => r.category === "real");

  console.log(`Generated labels: ${generated.length}`);
  console.log(`  Extract success: ${generated.filter((r) => r.extractSuccess).length}/${generated.length}`);
  console.log(`  Avg fields found: ${(generated.reduce((s, r) => s + r.fieldsFound, 0) / generated.length).toFixed(1)}`);
  console.log();

  console.log(`Real labels: ${real.length}`);
  console.log(`  Extract success: ${real.filter((r) => r.extractSuccess).length}/${real.length}`);
  console.log(`  Avg fields found: ${(real.reduce((s, r) => s + r.fieldsFound, 0) / real.length).toFixed(1)}`);
  console.log();

  console.log(`Total: ${results.length} labels`);
  console.log(`  Extraction failures: ${extractFailCount}`);
  console.log(`  Verify PASS: ${passCount}`);
  console.log(`  Verify FAIL: ${failCount}`);
  console.log();

  console.log(`Batch tests:`);
  console.log(`  Generated (${generatedPaths.length}): ${batchGenSuccess}/${generatedPaths.length} extracted in ${batchGenResult.totalProcessingTimeMs}ms`);
  console.log(`  Real sample (${realSample.length}): ${batchRealSuccess}/${realSample.length} extracted in ${batchRealResult.totalProcessingTimeMs}ms`);

  // Write results to file for reference
  writeFileSync(
    join(process.cwd(), "scripts", "validation-results.json"),
    JSON.stringify({ timestamp: new Date().toISOString(), results, summary: { total: results.length, extractFail: extractFailCount, pass: passCount, fail: failCount } }, null, 2)
  );
  console.log();
  console.log("Results written to scripts/validation-results.json");
}

main().catch(console.error);
