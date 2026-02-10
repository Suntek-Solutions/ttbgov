"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FieldVerificationResult } from "@/lib/types";

/** Friendly display names for field keys */
const FIELD_LABELS: Record<string, string> = {
  brandName: "Brand Name",
  classType: "Class / Type",
  alcoholContent: "Alcohol Content (ABV)",
  netContents: "Net Contents",
  governmentWarning: "Government Warning",
  producerInfo: "Producer / Bottler",
  countryOfOrigin: "Country of Origin",
};

interface VerificationResultsProps {
  overall: "pass" | "fail";
  results: FieldVerificationResult[];
  processingTimeMs: number;
}

export function VerificationResults({
  overall,
  results,
  processingTimeMs,
}: VerificationResultsProps) {
  const passCount = results.filter((r) => r.match).length;
  const totalCount = results.length;

  return (
    <Card
      className={`border-2 ${
        overall === "pass" ? "border-green-300 bg-green-50/50" : "border-red-300 bg-red-50/50"
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Verification Results</CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              {processingTimeMs}ms
            </span>
            <Badge
              variant={overall === "pass" ? "default" : "destructive"}
              className={`text-sm px-3 py-1 ${
                overall === "pass" ? "bg-green-600" : "bg-red-600"
              }`}
            >
              {overall === "pass" ? "ALL PASS" : "FAILED"}{" "}
              ({passCount}/{totalCount})
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {results.map((result) => (
            <div
              key={result.field}
              className={`flex items-start gap-3 rounded-lg p-3 ${
                result.match
                  ? "bg-green-100/60"
                  : "bg-red-100/60"
              }`}
            >
              {/* Pass/Fail icon */}
              <div
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold ${
                  result.match ? "bg-green-500" : "bg-red-500"
                }`}
              >
                {result.match ? "\u2713" : "\u2717"}
              </div>

              {/* Field details */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {FIELD_LABELS[result.field] ?? result.field}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {result.method}
                  </Badge>
                </div>
                <p className="mt-0.5 text-sm text-gray-600">
                  {result.details}
                </p>
                {result.extracted && (
                  <p className="mt-1 truncate text-xs text-gray-500">
                    Label: &quot;{result.extracted.length > 80 ? result.extracted.slice(0, 80) + "..." : result.extracted}&quot;
                  </p>
                )}
              </div>

              {/* Confidence */}
              {result.confidence > 0 && (
                <span className="shrink-0 text-xs text-gray-500">
                  {Math.round(result.confidence * 100)}%
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
