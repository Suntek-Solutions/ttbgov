"use client";

import Image from "next/image";

const EXAMPLE_LABELS = [
  {
    file: "/test-labels/generated/compliant-label.png",
    name: "Compliant Bourbon",
    description: "All fields correct -- should pass",
  },
  {
    file: "/test-labels/generated/wrong-abv.png",
    name: "Wrong ABV",
    description: "Label: 40%, App: 45% -- ABV should fail",
  },
  {
    file: "/test-labels/generated/wrong-warning-case.png",
    name: "Title Case Warning",
    description: '"Government Warning:" not all caps -- warning should fail',
  },
  {
    file: "/test-labels/generated/brand-case-mismatch.png",
    name: "Brand Case Mismatch",
    description: '"OLD TOM" on label vs "Old Tom" in form -- fuzzy match',
  },
  {
    file: "/test-labels/generated/missing-warning.png",
    name: "Missing Warning",
    description: "No government warning -- warning should fail",
  },
];

interface ExampleLabelPickerProps {
  onSelect: (file: File) => void;
}

export function ExampleLabelPicker({ onSelect }: ExampleLabelPickerProps) {
  const handleSelect = async (url: string, name: string) => {
    const response = await fetch(url);
    const blob = await response.blob();
    const file = new File([blob], `${name}.png`, { type: "image/png" });
    onSelect(file);
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p className="mb-3 text-sm font-medium text-amber-800">
        Example Labels (Demo Mode)
      </p>
      <div className="grid grid-cols-5 gap-2">
        {EXAMPLE_LABELS.map((label) => (
          <button
            key={label.file}
            onClick={() => handleSelect(label.file, label.name)}
            className="group rounded-lg border border-amber-200 bg-white p-2 text-left transition-colors hover:border-amber-400 hover:bg-amber-50"
          >
            <Image
              src={label.file}
              alt={label.name}
              width={120}
              height={80}
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
