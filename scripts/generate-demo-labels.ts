/**
 * Generate demo-labels.json from generated test labels + real COLA metadata.
 * 
 * Run: npx tsx scripts/generate-demo-labels.ts
 */

import { writeFileSync } from "fs";
import { join } from "path";
import metadata from "../public/test-labels/real/metadata.json";

const STANDARD_WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

function cleanClassType(desc: string): string {
  return desc
    .replace(/ FB$/, "")
    .replace(/\s*-\s*FLAVORED$/, "")
    .split("/")
    .map((s) => s.trim())
    .join(" / ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
    .replace(/ And /g, " and ")
    .replace(/ Or /g, " or ")
    .replace(/ Of /g, " of ")
    .replace(/\( /g, "(")
    .replace(/ \)/g, ")")
    .replace("Non Alcoholic", "Non-Alcoholic");
}

function cleanOrigin(desc: string): string | undefined {
  if (!desc) return undefined;
  const title = desc
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return "Product of " + title;
}

function titleCase(name: string): string {
  return name
    .split(" ")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Assign realistic ABV values based on beverage type and class.
 * Some are intentionally wrong (marked with _wrong suffix in internal tracking)
 * to create interesting test data.
 */
function assignAbv(
  category: string,
  classTypeDesc: string,
  index: number
): { value: string; intentionallyWrong: boolean } {
  // Every 5th real label gets an intentionally wrong ABV
  const makeWrong = index % 5 === 0;

  let baseAbv: number;

  if (category === "wine") {
    if (classTypeDesc.includes("DESSERT") || classTypeDesc.includes("PORT") || classTypeDesc.includes("SHERRY")) {
      baseAbv = 18;
    } else if (classTypeDesc.includes("WHITE")) {
      baseAbv = 12.5;
    } else {
      baseAbv = 13.5;
    }
  } else if (category === "malt_beverage") {
    if (classTypeDesc.includes("NON ALCOHOLIC") || classTypeDesc.includes("NEAR BEER")) {
      baseAbv = 0.5;
    } else if (classTypeDesc.includes("STOUT")) {
      baseAbv = 8;
    } else if (classTypeDesc.includes("SPECIALIT")) {
      baseAbv = 6;
    } else {
      baseAbv = 5.5;
    }
  } else {
    // distilled_spirits
    if (classTypeDesc.includes("TEQUILA")) {
      baseAbv = 40;
    } else if (classTypeDesc.includes("BOURBON") || classTypeDesc.includes("WHISKY") || classTypeDesc.includes("WHISKEY")) {
      baseAbv = 45;
    } else if (classTypeDesc.includes("GIN")) {
      baseAbv = 47;
    } else if (classTypeDesc.includes("BRANDY")) {
      baseAbv = 40;
    } else if (classTypeDesc.includes("LIQUEUR") || classTypeDesc.includes("CORDIAL")) {
      baseAbv = 35;
    } else {
      baseAbv = 40;
    }
  }

  if (makeWrong) {
    // Shift by 2-5% to make it clearly wrong but not absurd
    const shift = (index % 3 === 0) ? 3 : (index % 3 === 1) ? -2 : 5;
    return { value: (baseAbv + shift) + "%", intentionallyWrong: true };
  }

  return { value: baseAbv + "%", intentionallyWrong: false };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Generated test scenario labels
const generated = [
  {
    id: "compliant-bourbon",
    name: "Compliant Bourbon",
    description: "All fields correct -- should pass verification",
    category: "generated",
    file: "/test-labels/generated/compliant-label.png",
    expectedResult:
      "All 7 fields detected and verified. Brand name 'OLD TOM DISTILLERY' extracted via multi-pass OCR with explicit PSM initialization. Full pass expected.",
    applicationData: {
      brandName: "OLD TOM DISTILLERY",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45%",
      netContents: "750 mL",
      governmentWarning: STANDARD_WARNING,
      producerInfo:
        "Distilled and Bottled by Old Tom Distillery, Louisville, KY",
      countryOfOrigin: "Product of USA",
    },
  },
  {
    id: "wrong-abv",
    name: "Wrong ABV",
    description: "Label shows 40%, application says 45% -- ABV should fail",
    category: "generated",
    file: "/test-labels/generated/wrong-abv.png",
    expectedResult:
      "ABV fails (40% on label vs 45% in form). Demonstrates numeric mismatch detection.",
    applicationData: {
      brandName: "STONE'S THROW",
      classType: "Small Batch Bourbon Whiskey",
      alcoholContent: "45%",
      netContents: "750 mL",
      governmentWarning: STANDARD_WARNING,
      producerInfo:
        "Distilled by Stone's Throw Distillery, Portland, OR",
      countryOfOrigin: "Product of USA",
    },
  },
  {
    id: "wrong-warning-case",
    name: "Title Case Warning",
    description:
      '"Government Warning:" not all caps -- warning prefix should fail',
    category: "generated",
    file: "/test-labels/generated/wrong-warning-case.png",
    expectedResult:
      "Warning fails (prefix not in all caps). Demonstrates Jenny's exact check.",
    applicationData: {
      brandName: "COPPER RIDGE",
      classType: "Straight Rye Whiskey",
      alcoholContent: "50%",
      netContents: "750 mL",
      governmentWarning: STANDARD_WARNING,
    },
  },
  {
    id: "brand-case-mismatch",
    name: "Brand Case Mismatch",
    description:
      '"OLD TOM" on label vs "Old Tom" in form -- fuzzy match test',
    category: "generated",
    file: "/test-labels/generated/brand-case-mismatch.png",
    expectedResult:
      "Class/type and ABV pass. Brand OCR unreliable on bottle background.",
    applicationData: {
      brandName: "Old Tom",
      classType: "Cabernet Sauvignon",
      alcoholContent: "13.5%",
      netContents: "750 mL",
      governmentWarning: STANDARD_WARNING,
    },
  },
  {
    id: "missing-warning",
    name: "Missing Warning",
    description: "No government warning on label -- warning should fail",
    category: "generated",
    file: "/test-labels/generated/missing-warning.png",
    expectedResult:
      "Warning fails (not found on label). All other fields pass. Cleanest demo.",
    applicationData: {
      brandName: "HARBOR LIGHT",
      classType: "London Dry Gin",
      alcoholContent: "47%",
      netContents: "750 mL",
      governmentWarning: STANDARD_WARNING,
      producerInfo: "Distilled by Harbor Light Spirits, Seattle, WA",
      countryOfOrigin: "Product of USA",
    },
  },
];

// Generate real label entries from COLA metadata
const seen = new Set<string>();
let realIndex = 0;
const real = (metadata as Array<Record<string, string>>)
  .map((m) => {
    const slug = slugify(m.brand_name) + "-" + m.ttbid.slice(-4);
    if (seen.has(slug)) return null;
    seen.add(slug);

    const classType = cleanClassType(m.class_type_desc);
    const origin = cleanOrigin(m.origin_desc);
    const catLabel =
      m.category === "distilled_spirits"
        ? "Spirits"
        : m.category === "malt_beverage"
        ? "Beer/Malt"
        : "Wine";

    const displayName =
      titleCase(m.brand_name) +
      (m.fanciful_name ? " - " + titleCase(m.fanciful_name) : "");

    // Assign ABV -- some correct, some intentionally wrong
    const abv = assignAbv(m.category, m.class_type_desc, realIndex);
    realIndex++;

    // Adjust net contents for beer/malt (typically 12 oz, not 750 mL)
    const netContents = m.category === "malt_beverage" ? "12 oz" : "750 mL";

    const descSuffix = abv.intentionallyWrong ? " (ABV intentionally wrong)" : "";

    const appData: Record<string, string> = {
      brandName: m.brand_name,
      classType: classType,
      alcoholContent: abv.value,
      netContents: netContents,
      governmentWarning: STANDARD_WARNING,
    };
    if (origin) appData.countryOfOrigin = origin;

    return {
      id: "real-" + slug,
      name: displayName,
      description: "Real COLA -- " + catLabel + " -- " + classType + descSuffix,
      category: "real",
      bevType: m.category,
      file: "/" + m.local_path.replace(/^public\//, ""),
      ttbId: m.ttbid,
      applicationData: appData,
    };
  })
  .filter(Boolean);

const all = [...generated, ...real];

const outPath = join(process.cwd(), "public", "test-labels", "demo-labels.json");
writeFileSync(outPath, JSON.stringify(all, null, 2));

console.log(`Generated ${all.length} entries (${generated.length} generated + ${real.length} real)`);
console.log(`  Wine: ${real.filter((r: any) => r.bevType === "wine").length}`);
console.log(`  Spirits: ${real.filter((r: any) => r.bevType === "distilled_spirits").length}`);
console.log(`  Beer/Malt: ${real.filter((r: any) => r.bevType === "malt_beverage").length}`);
