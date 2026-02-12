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
  const [activeTab, setActiveTab] = useState<"scenarios" | "real">("scenarios");
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);

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
    setLoadingLabel(label.id);
    try {
      const response = await fetch(label.file);
      const blob = await response.blob();
      const filename = label.file.split("/").pop() ?? "label.png";
      const file = new File([blob], filename, { type: "image/png" });
      onSelect(file, label.applicationData, label.file);
    } finally {
      // Keep the loading state briefly to show feedback
      setTimeout(() => setLoadingLabel(null), 300);
    }
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
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-amber-800">
          Demo Labels ({labels.length})
        </p>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("scenarios")}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              activeTab === "scenarios"
                ? "bg-amber-300 text-amber-900"
                : "bg-amber-100 text-amber-700 hover:bg-amber-200"
            }`}
          >
            Test Scenarios ({generated.length})
          </button>
          <button
            onClick={() => setActiveTab("real")}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              activeTab === "real"
                ? "bg-amber-300 text-amber-900"
                : "bg-amber-100 text-amber-700 hover:bg-amber-200"
            }`}
          >
            Real COLA ({real.length})
          </button>
        </div>
      </div>

      <div className="max-h-[180px] overflow-y-auto rounded-md border border-amber-200 bg-white">
        <div className="grid grid-cols-5 gap-1.5 p-2">
          {(activeTab === "scenarios" ? generated : real).map((label) => {
            const isLoading = loadingLabel === label.id;
            return (
              <button
                key={label.id}
                onClick={() => handleSingleSelect(label)}
                disabled={isLoading}
                className={`group rounded-lg border p-1.5 text-left transition-all ${
                  isLoading
                    ? "border-green-400 bg-green-100 scale-95"
                    : "border-gray-150 bg-white hover:border-amber-400 hover:bg-amber-50 hover:scale-105"
                }`}
              >
                <div className="relative">
                  <Image
                    src={label.file}
                    alt={label.name}
                    width={240}
                    height={160}
                    unoptimized
                    className={`mb-1 h-[40px] w-full rounded object-contain transition-opacity ${
                      isLoading ? "opacity-50" : ""
                    }`}
                  />
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent"></div>
                    </div>
                  )}
                </div>
                <p className="text-[10px] font-medium text-gray-800 truncate">
                  {label.name}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
