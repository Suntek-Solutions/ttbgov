"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { ApplicationData, ExtractedFields, FieldVerificationResult } from "@/lib/types";
import { STANDARD_WARNING_TEXT } from "@/lib/extraction/patterns";
import { useDemo } from "@/lib/demo-context";

interface DemoLabelEntry {
  id: string;
  file: string;
  applicationData: ApplicationData;
}

const FIELDS: Array<{
  key: keyof ApplicationData;
  label: string;
  extractKey: keyof Omit<ExtractedFields, "rawText">;
  type: "text" | "textarea";
}> = [
  { key: "brandName", label: "Brand Name", extractKey: "brandName", type: "text" },
  { key: "classType", label: "Class / Type", extractKey: "classType", type: "text" },
  { key: "alcoholContent", label: "Alcohol Content (ABV)", extractKey: "alcoholContent", type: "text" },
  { key: "netContents", label: "Net Contents", extractKey: "netContents", type: "text" },
  { key: "producerInfo", label: "Producer / Bottler", extractKey: "producerInfo", type: "text" },
  { key: "countryOfOrigin", label: "Country of Origin", extractKey: "countryOfOrigin", type: "text" },
];

interface LabelComparisonViewProps {
  extracted: ExtractedFields;
  applicationData: ApplicationData;
  onChange: (data: ApplicationData) => void;
  verifyResults?: FieldVerificationResult[];
  disabled?: boolean;
  demoFillData?: ApplicationData | null;
  processingTimeMs: number;
}

export function LabelComparisonView({
  extracted,
  applicationData,
  onChange,
  verifyResults,
  disabled,
  demoFillData,
  processingTimeMs,
}: LabelComparisonViewProps) {
  const { demoMode } = useDemo();
  const [demoLabels, setDemoLabels] = useState<DemoLabelEntry[]>([]);

  // Load demo labels catalog so we can always offer fill button
  useEffect(() => {
    if (demoMode && demoLabels.length === 0) {
      fetch("/test-labels/demo-labels.json")
        .then((r) => r.json())
        .then((data: DemoLabelEntry[]) => setDemoLabels(data))
        .catch(() => {});
    }
  }, [demoMode, demoLabels.length]);

  const update = (field: keyof ApplicationData, value: string) => {
    onChange({ ...applicationData, [field]: value });
  };

  const getResult = (field: string): FieldVerificationResult | undefined =>
    verifyResults?.find((r) => r.field === field);

  const isEmpty = !applicationData.brandName && !applicationData.classType;

  // Find demo data: use prop first, then match from catalog by extracted class type
  let matchedDemoData = demoFillData ?? null;
  if (!matchedDemoData && demoMode && demoLabels.length > 0 && extracted.classType.value) {
    const ct = extracted.classType.value.toLowerCase();
    const match = demoLabels.find((d) =>
      d.applicationData?.classType?.toLowerCase() === ct
    );
    if (match) matchedDemoData = match.applicationData;
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          Field-by-Field Comparison
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">OCR: {processingTimeMs}ms</span>
          {demoMode && matchedDemoData && (
            <button
              type="button"
              onClick={() => onChange(matchedDemoData!)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                isEmpty
                  ? "bg-amber-200 text-amber-900 border border-amber-400 animate-pulse"
                  : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
              }`}
              disabled={disabled}
            >
              {isEmpty ? "Fill Demo Data" : "Re-fill"}
            </button>
          )}
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">
        <span>OCR Extracted</span>
        <span className="w-8" />
        <span>Application Data</span>
      </div>

      {/* Field rows */}
      <div className="rounded-lg border bg-white divide-y">
        {FIELDS.map(({ key, label, extractKey }) => {
          const ocrField = extracted[extractKey];
          const appValue = applicationData[key] ?? "";
          const result = getResult(key);

          return (
            <div key={key} className={`grid grid-cols-[1fr_auto_1fr] gap-2 items-start px-3 py-2.5 ${
              result ? (result.match ? "bg-green-50/50" : "bg-red-50/50") : ""
            }`}>
              {/* OCR value */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] text-gray-400">{label}</span>
                  {ocrField.value ? (
                    <Badge variant="outline" className="text-[9px] px-1 py-0">{Math.round(ocrField.confidence * 100)}%</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0">not found</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-800 truncate">
                  {ocrField.value ?? <span className="text-gray-400 italic">--</span>}
                </p>
              </div>

              {/* Match indicator */}
              <div className="flex items-center justify-center w-8 pt-3">
                {result ? (
                  result.match ? (
                    <span className="text-green-600 text-base font-bold">{"\u2713"}</span>
                  ) : (
                    <span className="text-red-500 text-base font-bold">{"\u2717"}</span>
                  )
                ) : (
                  <span className="text-gray-300">{"\u2192"}</span>
                )}
              </div>

              {/* Application input */}
              <div className="min-w-0">
                <Input
                  value={appValue}
                  onChange={(e) => update(key, e.target.value)}
                  placeholder={ocrField.value ? `OCR: ${ocrField.value.substring(0, 25)}` : `Enter ${label.toLowerCase()}`}
                  disabled={disabled}
                  className={`text-sm h-8 ${
                    result ? (result.match ? "border-green-300" : "border-red-300") : ""
                  }`}
                />
                {result && !result.match && (
                  <p className="text-[10px] text-red-600 mt-0.5 truncate">{result.details}</p>
                )}
              </div>
            </div>
          );
        })}

        {/* Government Warning -- special full-width row */}
        <div className={`px-3 py-2.5 ${
          getResult("governmentWarning") 
            ? (getResult("governmentWarning")!.match ? "bg-green-50/50" : "bg-red-50/50") 
            : ""
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400">Government Warning</span>
              {extracted.governmentWarning.value ? (
                <Badge variant="outline" className="text-[9px] px-1 py-0">{Math.round(extracted.governmentWarning.confidence * 100)}%</Badge>
              ) : (
                <Badge variant="secondary" className="text-[9px] px-1 py-0">not found on label</Badge>
              )}
              {getResult("governmentWarning") && (
                getResult("governmentWarning")!.match
                  ? <span className="text-green-600 text-xs font-bold ml-1">{"\u2713"} Valid</span>
                  : <span className="text-red-500 text-xs font-bold ml-1">{"\u2717"} Failed</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => update("governmentWarning", STANDARD_WARNING_TEXT)}
              className="text-[10px] text-blue-600 hover:text-blue-800"
              disabled={disabled}
            >
              Fill standard warning
            </button>
          </div>
          {extracted.governmentWarning.value && (
            <p className="text-xs text-gray-600 mb-1.5 line-clamp-2">
              OCR: {extracted.governmentWarning.value.substring(0, 150)}...
            </p>
          )}
          <Textarea
            value={applicationData.governmentWarning}
            onChange={(e) => update("governmentWarning", e.target.value)}
            placeholder="GOVERNMENT WARNING: (1) According to the Surgeon General..."
            rows={2}
            className={`text-xs ${
              getResult("governmentWarning")
                ? (getResult("governmentWarning")!.match ? "border-green-300" : "border-red-300")
                : ""
            }`}
            disabled={disabled}
          />
          {getResult("governmentWarning") && !getResult("governmentWarning")!.match && (
            <p className="text-[10px] text-red-600 mt-0.5">{getResult("governmentWarning")!.details}</p>
          )}
        </div>
      </div>
    </div>
  );
}
