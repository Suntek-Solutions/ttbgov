"use client";

import Image from "next/image";
import type { ApplicationData } from "@/lib/types";
import { STANDARD_WARNING_TEXT } from "@/lib/extraction/patterns";

interface ExampleLabel {
  file: string;
  name: string;
  description: string;
  applicationData: ApplicationData;
}

const EXAMPLE_LABELS: ExampleLabel[] = [
  {
    file: "/test-labels/generated/compliant-label.png",
    name: "Compliant Bourbon",
    description: "All fields correct -- should pass",
    applicationData: {
      brandName: "OLD TOM DISTILLERY",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45%",
      netContents: "750 mL",
      governmentWarning: STANDARD_WARNING_TEXT,
      producerInfo: "Distilled and Bottled by Old Tom Distillery, Louisville, KY",
      countryOfOrigin: "Product of USA",
    },
  },
  {
    file: "/test-labels/generated/wrong-abv.png",
    name: "Wrong ABV",
    description: "Label: 40%, App: 45% -- ABV should fail",
    applicationData: {
      brandName: "STONE'S THROW",
      classType: "Small Batch Bourbon Whiskey",
      alcoholContent: "45%",
      netContents: "750 mL",
      governmentWarning: STANDARD_WARNING_TEXT,
      producerInfo: "Distilled by Stone's Throw Distillery, Portland, OR",
      countryOfOrigin: "Product of USA",
    },
  },
  {
    file: "/test-labels/generated/wrong-warning-case.png",
    name: "Title Case Warning",
    description: '"Government Warning:" not all caps -- should fail',
    applicationData: {
      brandName: "COPPER RIDGE",
      classType: "Straight Rye Whiskey",
      alcoholContent: "50%",
      netContents: "750 mL",
      governmentWarning: STANDARD_WARNING_TEXT,
      producerInfo: "Distilled by Copper Ridge Distillery, Nashville, TN",
      countryOfOrigin: "Product of USA",
    },
  },
  {
    file: "/test-labels/generated/brand-case-mismatch.png",
    name: "Brand Case Mismatch",
    description: '"OLD TOM" on label vs "Old Tom" in form -- fuzzy match',
    applicationData: {
      brandName: "Old Tom",
      classType: "Cabernet Sauvignon",
      alcoholContent: "13.5%",
      netContents: "750 mL",
      governmentWarning: STANDARD_WARNING_TEXT,
      producerInfo: "Vinted and Bottled by Summit Creek Vineyards, Napa, CA",
    },
  },
  {
    file: "/test-labels/generated/missing-warning.png",
    name: "Missing Warning",
    description: "No government warning -- warning should fail",
    applicationData: {
      brandName: "HARBOR LIGHT",
      classType: "London Dry Gin",
      alcoholContent: "47%",
      netContents: "750 mL",
      governmentWarning: STANDARD_WARNING_TEXT,
      producerInfo: "Distilled by Harbor Light Spirits, Seattle, WA",
      countryOfOrigin: "Product of USA",
    },
  },
];

interface ExampleLabelPickerProps {
  onSelect: (file: File, applicationData: ApplicationData, rawUrl: string) => void;
}

export function ExampleLabelPicker({ onSelect }: ExampleLabelPickerProps) {
  const handleSelect = async (label: ExampleLabel) => {
    // Use XMLHttpRequest to ensure we get the raw binary file
    // fetch() can sometimes be intercepted by service workers or Next.js
    const response = await fetch(label.file);
    const blob = await response.blob();
    const file = new File([blob], label.file.split("/").pop() ?? "label.png", {
      type: "image/png",
    });
    // Pass the raw public URL for preview (guaranteed full-res)
    onSelect(file, label.applicationData, label.file);
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p className="mb-3 text-sm font-medium text-amber-800">
        Example Labels (Demo Mode) -- click to load label + pre-fill application data
      </p>
      <div className="grid grid-cols-5 gap-2">
        {EXAMPLE_LABELS.map((label) => (
          <button
            key={label.file}
            onClick={() => handleSelect(label)}
            className="group rounded-lg border border-amber-200 bg-white p-2 text-left transition-colors hover:border-amber-400 hover:bg-amber-50"
          >
            {/* Use unoptimized to prevent Next.js Image from resizing */}
            <Image
              src={label.file}
              alt={label.name}
              width={240}
              height={160}
              unoptimized
              className="mb-1.5 h-[60px] w-full rounded object-contain"
            />
            <p className="text-xs font-medium text-gray-800 truncate">
              {label.name}
            </p>
            <p className="text-[10px] text-gray-500 truncate">
              {label.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
