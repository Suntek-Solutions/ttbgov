"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ApplicationData } from "@/lib/types";
import { STANDARD_WARNING_TEXT } from "@/lib/extraction/patterns";
import { useDemo } from "@/lib/demo-context";

/** Demo test data keyed by patterns found in OCR text */
const DEMO_DATA: Record<string, ApplicationData> = {
  "bourbon whiskey_45%": {
    brandName: "OLD TOM DISTILLERY",
    classType: "Kentucky Straight Bourbon Whiskey",
    alcoholContent: "45%",
    netContents: "750 mL",
    governmentWarning: STANDARD_WARNING_TEXT,
    producerInfo: "Distilled and Bottled by Old Tom Distillery, Louisville, KY",
    countryOfOrigin: "Product of USA",
  },
  "bourbon whiskey_40%": {
    brandName: "STONE'S THROW",
    classType: "Small Batch Bourbon Whiskey",
    alcoholContent: "45%", // intentional mismatch
    netContents: "750 mL",
    governmentWarning: STANDARD_WARNING_TEXT,
    producerInfo: "Distilled by Stone's Throw Distillery, Portland, OR",
    countryOfOrigin: "Product of USA",
  },
  "rye whiskey": {
    brandName: "COPPER RIDGE",
    classType: "Straight Rye Whiskey",
    alcoholContent: "50%",
    netContents: "750 mL",
    governmentWarning: STANDARD_WARNING_TEXT,
    producerInfo: "Distilled by Copper Ridge Distillery, Nashville, TN",
    countryOfOrigin: "Product of USA",
  },
  "cabernet": {
    brandName: "Old Tom",
    classType: "Cabernet Sauvignon",
    alcoholContent: "13.5%",
    netContents: "750 mL",
    governmentWarning: STANDARD_WARNING_TEXT,
    producerInfo: "Vinted and Bottled by Summit Creek Vineyards, Napa, CA",
  },
  "london dry gin": {
    brandName: "HARBOR LIGHT",
    classType: "London Dry Gin",
    alcoholContent: "47%",
    netContents: "750 mL",
    governmentWarning: STANDARD_WARNING_TEXT,
    producerInfo: "Distilled by Harbor Light Spirits, Seattle, WA",
    countryOfOrigin: "Product of USA",
  },
};

function findDemoData(ocrClassType: string | undefined, ocrAbv: string | undefined): ApplicationData | null {
  if (!ocrClassType) return null;
  const ct = ocrClassType.toLowerCase();
  const abv = ocrAbv ?? "";

  if (ct.includes("cabernet")) return DEMO_DATA["cabernet"];
  if (ct.includes("gin")) return DEMO_DATA["london dry gin"];
  if (ct.includes("rye")) return DEMO_DATA["rye whiskey"];
  if (ct.includes("bourbon") && abv.includes("40")) return DEMO_DATA["bourbon whiskey_40%"];
  if (ct.includes("bourbon")) return DEMO_DATA["bourbon whiskey_45%"];
  return null;
}

interface ApplicationFormProps {
  data: ApplicationData;
  onChange: (data: ApplicationData) => void;
  disabled?: boolean;
  /** Pass extracted class/type and ABV so demo mode can auto-match test data */
  extractedClassType?: string | null;
  extractedAbv?: string | null;
}

export function ApplicationForm({ data, onChange, disabled, extractedClassType, extractedAbv }: ApplicationFormProps) {
  const { demoMode } = useDemo();

  const update = (field: keyof ApplicationData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const isEmpty = !data.brandName && !data.classType && !data.alcoholContent && !data.netContents;
  const matchedDemoData = demoMode ? findDemoData(extractedClassType ?? undefined, extractedAbv ?? undefined) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Application Data</h3>
        {demoMode && matchedDemoData && (
          <button
            type="button"
            onClick={() => onChange(matchedDemoData)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              isEmpty
                ? "bg-amber-200 text-amber-900 border border-amber-400 animate-pulse"
                : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
            }`}
            disabled={disabled}
          >
            {isEmpty ? "Fill Demo Data" : "Re-fill Demo Data"}
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="brandName">Brand Name</Label>
          <Input
            id="brandName"
            placeholder="e.g. OLD TOM DISTILLERY"
            value={data.brandName}
            onChange={(e) => update("brandName", e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="classType">Class / Type</Label>
          <Input
            id="classType"
            placeholder="e.g. Kentucky Straight Bourbon Whiskey"
            value={data.classType}
            onChange={(e) => update("classType", e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="alcoholContent">Alcohol Content (ABV)</Label>
          <Input
            id="alcoholContent"
            placeholder="e.g. 45%"
            value={data.alcoholContent}
            onChange={(e) => update("alcoholContent", e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="netContents">Net Contents</Label>
          <Input
            id="netContents"
            placeholder="e.g. 750 mL"
            value={data.netContents}
            onChange={(e) => update("netContents", e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="producerInfo">Producer / Bottler (optional)</Label>
          <Input
            id="producerInfo"
            placeholder="e.g. Distilled by Old Tom Distillery, Louisville, KY"
            value={data.producerInfo ?? ""}
            onChange={(e) => update("producerInfo", e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="countryOfOrigin">Country of Origin (optional)</Label>
          <Input
            id="countryOfOrigin"
            placeholder="e.g. Product of USA"
            value={data.countryOfOrigin ?? ""}
            onChange={(e) => update("countryOfOrigin", e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="governmentWarning">Government Warning Statement</Label>
          <button
            type="button"
            onClick={() => update("governmentWarning", STANDARD_WARNING_TEXT)}
            className="text-xs text-blue-600 hover:text-blue-800"
            disabled={disabled}
          >
            Fill standard warning
          </button>
        </div>
        <Textarea
          id="governmentWarning"
          placeholder="GOVERNMENT WARNING: (1) According to the Surgeon General..."
          value={data.governmentWarning}
          onChange={(e) => update("governmentWarning", e.target.value)}
          rows={3}
          className="text-sm"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
