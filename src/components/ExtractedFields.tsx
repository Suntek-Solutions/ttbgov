"use client";

import { Badge } from "@/components/ui/badge";
import type { ExtractedFields as ExtractedFieldsType } from "@/lib/types";

const FIELD_LABELS: Record<string, string> = {
  brandName: "Brand Name",
  classType: "Class / Type",
  alcoholContent: "Alcohol Content",
  netContents: "Net Contents",
  governmentWarning: "Government Warning",
  producerInfo: "Producer / Bottler",
  countryOfOrigin: "Country of Origin",
};

interface ExtractedFieldsProps {
  fields: ExtractedFieldsType;
  processingTimeMs: number;
}

export function ExtractedFields({ fields, processingTimeMs }: ExtractedFieldsProps) {
  const entries = Object.entries(fields).filter(([key]) => key !== "rawText") as Array<
    [string, { value: string | null; confidence: number }]
  >;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          Extracted from Label (OCR)
        </h3>
        <span className="text-xs text-gray-500">{processingTimeMs}ms</span>
      </div>

      <div className="divide-y rounded-lg border bg-white">
        {entries.map(([key, field]) => (
          <div key={key} className="flex items-center justify-between px-3 py-2">
            <div className="min-w-0 flex-1">
              <span className="text-xs text-gray-500">
                {FIELD_LABELS[key] ?? key}
              </span>
              <p className="truncate text-sm text-gray-900">
                {field.value
                  ? field.value.length > 70
                    ? field.value.slice(0, 70) + "..."
                    : field.value
                  : "--"}
              </p>
            </div>
            {field.value ? (
              <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">
                {Math.round(field.confidence * 100)}%
              </Badge>
            ) : (
              <Badge variant="secondary" className="ml-2 shrink-0 text-[10px]">
                not found
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
