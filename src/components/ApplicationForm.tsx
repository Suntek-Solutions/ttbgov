"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ApplicationData } from "@/lib/types";
import { STANDARD_WARNING_TEXT } from "@/lib/extraction/patterns";

interface ApplicationFormProps {
  data: ApplicationData;
  onChange: (data: ApplicationData) => void;
  disabled?: boolean;
}

export function ApplicationForm({ data, onChange, disabled }: ApplicationFormProps) {
  const update = (field: keyof ApplicationData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-700">Application Data</h3>

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
