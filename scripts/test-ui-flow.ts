/**
 * UI Flow Integration Test
 * 
 * Tests the full app flow by calling the API endpoints directly
 * (simulating what the UI does) to verify all scenarios work.
 * 
 * Run: npx tsx scripts/test-ui-flow.ts
 */

import { readFileSync } from "fs";
import { join } from "path";

const BASE_URL = "http://localhost:3000";
const DIR = join(process.cwd(), "public", "test-labels", "generated");

const STANDARD_WARNING = "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

interface TestCase {
  name: string;
  file: string;
  applicationData: Record<string, string>;
  expectedOverall: string;
  expectedWarningMatch: boolean;
  expectedAbvMatch: boolean;
}

const TEST_CASES: TestCase[] = [
  {
    name: "Compliant Bourbon (should mostly pass)",
    file: "compliant-label.png",
    applicationData: {
      brandName: "OLD TOM DISTILLERY",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45%",
      netContents: "750 mL",
      governmentWarning: STANDARD_WARNING,
      producerInfo: "Distilled and Bottled by Old Tom Distillery, Louisville, KY",
      countryOfOrigin: "Product of USA",
    },
    expectedOverall: "pass", // brand now detected via multi-pass OCR
    expectedWarningMatch: true,
    expectedAbvMatch: true,
  },
  {
    name: "Wrong ABV (ABV should fail)",
    file: "wrong-abv.png",
    applicationData: {
      brandName: "STONE'S THROW",
      classType: "Small Batch Bourbon Whiskey",
      alcoholContent: "45%",
      netContents: "750 mL",
      governmentWarning: STANDARD_WARNING,
    },
    expectedOverall: "fail",
    expectedWarningMatch: true,
    expectedAbvMatch: false,
  },
  {
    name: "Title Case Warning (warning should fail)",
    file: "wrong-warning-case.png",
    applicationData: {
      brandName: "COPPER RIDGE",
      classType: "Straight Rye Whiskey",
      alcoholContent: "50%",
      netContents: "750 mL",
      governmentWarning: STANDARD_WARNING,
    },
    expectedOverall: "fail",
    expectedWarningMatch: false,
    expectedAbvMatch: true,
  },
  {
    name: "Missing Warning (warning should fail)",
    file: "missing-warning.png",
    applicationData: {
      brandName: "HARBOR LIGHT",
      classType: "London Dry Gin",
      alcoholContent: "47%",
      netContents: "750 mL",
      governmentWarning: STANDARD_WARNING,
    },
    expectedOverall: "fail",
    expectedWarningMatch: false,
    expectedAbvMatch: true,
  },
];

async function testExtract(filePath: string): Promise<any> {
  const fileBuffer = readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: "image/png" });
  const formData = new FormData();
  formData.append("image", blob, filePath.split(/[/\\]/).pop()!);

  const res = await fetch(`${BASE_URL}/api/extract`, {
    method: "POST",
    body: formData,
  });
  return res.json();
}

async function testVerify(extracted: any, application: Record<string, string>): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ extracted: extracted.fields, application }),
  });
  return res.json();
}

async function testBatch(files: string[]): Promise<any> {
  const formData = new FormData();
  for (const f of files) {
    const buf = readFileSync(f);
    const blob = new Blob([buf], { type: "image/png" });
    formData.append("images", blob, f.split(/[/\\]/).pop()!);
  }
  const res = await fetch(`${BASE_URL}/api/batch`, {
    method: "POST",
    body: formData,
  });
  return res.json();
}

async function main() {
  console.log("=".repeat(70));
  console.log("TTB Label Verification -- UI Flow Integration Test");
  console.log("=".repeat(70));
  console.log();

  let allPassed = true;

  // TEST: Individual label verification flow
  for (const tc of TEST_CASES) {
    console.log(`--- ${tc.name} ---`);
    const filePath = join(DIR, tc.file);

    // Step 1: Extract
    const extractResult = await testExtract(filePath);
    if (!extractResult.success) {
      console.log(`  EXTRACT FAILED: ${extractResult.error}`);
      allPassed = false;
      continue;
    }
    console.log(`  Extract: ${extractResult.processingTimeMs}ms, ${extractResult.fields ? "OK" : "FAIL"}`);

    // Step 2: Verify
    const verifyResult = await testVerify(extractResult, tc.applicationData);
    if (!verifyResult.success) {
      console.log(`  VERIFY FAILED: ${verifyResult.error}`);
      allPassed = false;
      continue;
    }

    const warningResult = verifyResult.results?.find((r: any) => r.field === "governmentWarning");
    const abvResult = verifyResult.results?.find((r: any) => r.field === "alcoholContent");

    const overallCorrect = verifyResult.overall === tc.expectedOverall;
    const warningCorrect = warningResult?.match === tc.expectedWarningMatch;
    const abvCorrect = abvResult?.match === tc.expectedAbvMatch;

    console.log(`  Overall: ${verifyResult.overall} (expected: ${tc.expectedOverall}) ${overallCorrect ? "OK" : "WRONG"}`);
    console.log(`  Warning: ${warningResult?.match ? "PASS" : "FAIL"} (expected: ${tc.expectedWarningMatch ? "PASS" : "FAIL"}) ${warningCorrect ? "OK" : "WRONG"}`);
    console.log(`  ABV: ${abvResult?.match ? "PASS" : "FAIL"} (expected: ${tc.expectedAbvMatch ? "PASS" : "FAIL"}) ${abvCorrect ? "OK" : "WRONG"}`);

    if (!overallCorrect || !warningCorrect || !abvCorrect) allPassed = false;
    console.log();
  }

  // TEST: Batch processing
  console.log("--- Batch Processing ---");
  const batchFiles = ["compliant-label.png", "missing-warning.png", "wrong-abv.png"].map(f => join(DIR, f));
  const batchResult = await testBatch(batchFiles);
  
  if (batchResult.success && batchResult.results) {
    console.log(`  Batch: ${batchResult.results.length} files processed in ${batchResult.totalProcessingTimeMs}ms`);
    for (const r of batchResult.results) {
      const status = r.extraction ? "OK" : "FAIL";
      const warning = r.extraction?.governmentWarning?.value ? "found" : "not found";
      console.log(`  ${r.filename}: ${status}, warning: ${warning}`);
    }
  } else {
    console.log(`  Batch FAILED`);
    allPassed = false;
  }

  // TEST: Re-verify (simulates editing form and re-verifying)
  console.log();
  console.log("--- Re-verify Flow (edit form, verify again) ---");
  const extractForReVerify = await testExtract(join(DIR, "missing-warning.png"));
  
  // First verify with correct data
  const verify1 = await testVerify(extractForReVerify, {
    brandName: "HARBOR LIGHT",
    classType: "London Dry Gin",
    alcoholContent: "47%",
    netContents: "750 mL",
    governmentWarning: STANDARD_WARNING,
  });
  console.log(`  First verify: ${verify1.overall} (expected: fail due to missing warning)`);

  // Re-verify with wrong ABV (simulating user edit)
  const verify2 = await testVerify(extractForReVerify, {
    brandName: "HARBOR LIGHT",
    classType: "London Dry Gin",
    alcoholContent: "40%", // Changed from 47% to 40%
    netContents: "750 mL",
    governmentWarning: STANDARD_WARNING,
  });
  const abvFailed = verify2.results?.find((r: any) => r.field === "alcoholContent")?.match === false;
  console.log(`  Re-verify with wrong ABV: ${verify2.overall}, ABV failed: ${abvFailed} (expected: true)`);
  if (!abvFailed) allPassed = false;

  console.log();
  console.log("=".repeat(70));
  console.log(allPassed ? "ALL TESTS PASSED" : "SOME TESTS FAILED");
  console.log("=".repeat(70));
}

main().catch(console.error);
