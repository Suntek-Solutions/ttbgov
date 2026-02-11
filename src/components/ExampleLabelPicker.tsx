"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { ApplicationData } from "@/lib/types";

interface DemoLabel {
  id: string;
  name: string;
  description: string;
  category: string;
  file: string;
  applicationData: ApplicationData;
}

interface ExampleLabelPickerProps {
  onSelect: (file: File, applicationData: ApplicationData, rawUrl: string) => void;
  /** "single" shows grid picker, "batch" shows select-all for batch mode */
  mode?: "single" | "batch";
  onBatchSelect?: (files: File[], rawUrls: string[]) => void;
}

export function ExampleLabelPicker({ onSelect, mode = "single", onBatchSelect }: ExampleLabelPickerProps) {
  const [labels, setLabels] = useState<DemoLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/test-labels/demo-labels.json")
      .then((res) => res.json())
      .then((data: DemoLabel[]) => {
        setLabels(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSingleSelect = async (label: DemoLabel) => {
    const response = await fetch(label.file);
    const blob = await response.blob();
    const filename = label.file.split("/").pop() ?? "label.png";
    const file = new File([blob], filename, { type: "image/png" });
    onSelect(file, label.applicationData, label.file);
  };

  const handleBatchLoadAll = async () => {
    if (!onBatchSelect) return;
    const files: File[] = [];
    const urls: string[] = [];
    for (const label of labels) {
      const response = await fetch(label.file);
      const blob = await response.blob();
      const filename = label.file.split("/").pop() ?? "label.png";
      files.push(new File([blob], filename, { type: blob.type || "image/png" }));
      urls.push(label.file);
    }
    onBatchSelect(files, urls);
  };

  const handleBatchLoadSelected = async () => {
    if (!onBatchSelect) return;
    const selected = labels.filter((l) => selectedBatch.has(l.id));
    const files: File[] = [];
    const urls: string[] = [];
    for (const label of selected) {
      const response = await fetch(label.file);
      const blob = await response.blob();
      const filename = label.file.split("/").pop() ?? "label.png";
      files.push(new File([blob], filename, { type: blob.type || "image/png" }));
      urls.push(label.file);
    }
    onBatchSelect(files, urls);
  };

  const toggleBatchItem = (id: string) => {
    setSelectedBatch((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) return null;

  const generated = labels.filter((l) => l.category === "generated");
  const real = labels.filter((l) => l.category === "real");

  if (mode === "batch") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
        <p className="text-sm font-medium text-amber-800">
          Demo Labels ({labels.length} available)
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleBatchLoadAll}
            className="rounded-md bg-amber-200 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-300"
          >
            Load All {labels.length} Labels
          </button>
          {selectedBatch.size > 0 && (
            <button
              onClick={handleBatchLoadSelected}
              className="rounded-md bg-amber-200 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-300"
            >
              Load {selectedBatch.size} Selected
            </button>
          )}
        </div>
        <div className="grid grid-cols-5 gap-1.5 max-h-[200px] overflow-y-auto">
          {labels.map((label) => (
            <button
              key={label.id}
              onClick={() => toggleBatchItem(label.id)}
              className={`rounded border p-1.5 text-left text-[10px] transition-colors ${
                selectedBatch.has(label.id)
                  ? "border-amber-500 bg-amber-100"
                  : "border-amber-200 bg-white hover:bg-amber-50"
              }`}
            >
              <p className="font-medium text-gray-800 truncate">{label.name}</p>
              <p className="text-gray-500 truncate">{label.category}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-4">
      <p className="text-sm font-medium text-amber-800">
        Demo Labels -- click to load label + auto-fill application data
      </p>

      {/* Generated test cases */}
      <div>
        <p className="mb-2 text-xs font-medium text-amber-700">
          Test Scenarios ({generated.length})
        </p>
        <div className="grid grid-cols-5 gap-2">
          {generated.map((label) => (
            <button
              key={label.id}
              onClick={() => handleSingleSelect(label)}
              className="group rounded-lg border border-amber-200 bg-white p-2 text-left transition-colors hover:border-amber-400 hover:bg-amber-50"
            >
              <Image
                src={label.file}
                alt={label.name}
                width={240}
                height={160}
                unoptimized
                className="mb-1.5 h-[50px] w-full rounded object-contain"
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

      {/* Real COLA labels */}
      {real.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-amber-700">
            Real COLA Labels ({real.length})
          </p>
          <div className="grid grid-cols-5 gap-2">
            {real.map((label) => (
              <button
                key={label.id}
                onClick={() => handleSingleSelect(label)}
                className="group rounded-lg border border-amber-200 bg-white p-2 text-left transition-colors hover:border-amber-400 hover:bg-amber-50"
              >
                <Image
                  src={label.file}
                  alt={label.name}
                  width={240}
                  height={160}
                  unoptimized
                  className="mb-1.5 h-[50px] w-full rounded object-contain"
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
      )}
    </div>
  );
}
