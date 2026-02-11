"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useDemo } from "@/lib/demo-context";
import type { ExtractedFields } from "@/lib/types";

const EXAMPLE_BATCH_LABELS = [
  "/test-labels/generated/compliant-label.png",
  "/test-labels/generated/wrong-abv.png",
  "/test-labels/generated/wrong-warning-case.png",
  "/test-labels/generated/missing-warning.png",
  "/test-labels/generated/brand-case-mismatch.png",
];

interface BatchResult {
  filename: string;
  extraction: ExtractedFields | null;
  error?: string;
}

export default function BatchPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { demoMode, addLog } = useDemo();

  const loadExampleBatch = async () => {
    if (demoMode) addLog("Loading all 5 example labels for batch processing...");
    const loaded: File[] = [];
    for (const url of EXAMPLE_BATCH_LABELS) {
      const res = await fetch(url);
      const blob = await res.blob();
      const name = url.split("/").pop() ?? "label.png";
      loaded.push(new File([blob], name, { type: "image/png" }));
    }
    setFiles(loaded);
    setResults([]);
    setProgress(0);
    setError(null);
    if (demoMode) addLog(`Loaded ${loaded.length} example labels`);
  };

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? []).filter((f) =>
        f.type.startsWith("image/")
      );
      setFiles(selected);
      setResults([]);
      setProgress(0);
      setError(null);
    },
    []
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    setFiles(dropped);
    setResults([]);
    setProgress(0);
    setError(null);
  }, []);

  const handleProcess = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setResults([]);
    setProgress(0);

    try {
      // Process files in batches of 3 client-side for progress tracking
      const batchSize = 3;
      const allResults: BatchResult[] = [];

      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);

        const batchPromises = batch.map(async (file) => {
          const formData = new FormData();
          formData.append("image", file);

          try {
            const res = await fetch("/api/extract", {
              method: "POST",
              body: formData,
            });
            const data = await res.json();
            return {
              filename: file.name,
              extraction: data.success ? data.fields : null,
              error: data.error,
            } as BatchResult;
          } catch {
            return {
              filename: file.name,
              extraction: null,
              error: "Network error",
            } as BatchResult;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        allResults.push(...batchResults);
        setResults([...allResults]);
        setProgress(Math.round((allResults.length / files.length) * 100));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Batch processing failed."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setResults([]);
    setProgress(0);
    setError(null);
  };

  const successCount = results.filter((r) => r.extraction).length;
  const failCount = results.filter((r) => !r.extraction).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Batch Upload</h1>
        <p className="mt-1 text-gray-600">
          Upload multiple label images and extract text from all of them at
          once. Ideal for high-volume importers.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      {/* Upload area */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Label Images</CardTitle>
          <CardDescription>
            Select multiple images at once. The system will process them in
            parallel batches.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Demo mode: load example labels */}
          {demoMode && files.length === 0 && (
            <button
              onClick={loadExampleBatch}
              className="w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100"
            >
              Load All 5 Example Labels (Demo Mode)
            </button>
          )}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white transition-colors hover:border-blue-400 hover:bg-blue-50/50"
          >
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="absolute inset-0 cursor-pointer opacity-0"
              disabled={isProcessing}
            />
            <div className="flex flex-col items-center gap-1 p-6">
              <p className="text-base font-medium text-gray-700">
                {files.length > 0
                  ? `${files.length} image${files.length > 1 ? "s" : ""} selected`
                  : "Drop images here, or click to select multiple"}
              </p>
              <p className="text-sm text-gray-500">
                JPEG, PNG, or WebP -- select as many as needed
              </p>
            </div>
          </div>

          {files.length > 0 && (
            <div className="flex gap-2">
              <Button
                onClick={handleProcess}
                disabled={isProcessing}
                size="lg"
                className="flex-1 text-base"
              >
                {isProcessing
                  ? `Processing... (${results.length}/${files.length})`
                  : `Extract All ${files.length} Labels`}
              </Button>
              <Button
                onClick={handleReset}
                variant="outline"
                size="lg"
                disabled={isProcessing}
              >
                Clear
              </Button>
            </div>
          )}

          {/* Progress bar */}
          {isProcessing && (
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-gray-500 text-center">
                {results.length} of {files.length} processed
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results table */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Batch Results
              </CardTitle>
              <div className="flex gap-2">
                <Badge className="bg-green-600">
                  {successCount} extracted
                </Badge>
                {failCount > 0 && (
                  <Badge variant="destructive">
                    {failCount} failed
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y rounded-lg border">
              {results.map((result, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-4 py-3 ${
                    result.extraction ? "" : "bg-red-50"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {result.filename}
                    </p>
                    {result.extraction ? (
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                        {result.extraction.brandName.value && (
                          <span>Brand: {result.extraction.brandName.value}</span>
                        )}
                        {result.extraction.classType.value && (
                          <span>Type: {result.extraction.classType.value}</span>
                        )}
                        {result.extraction.alcoholContent.value && (
                          <span>ABV: {result.extraction.alcoholContent.value}</span>
                        )}
                        {result.extraction.netContents.value && (
                          <span>Vol: {result.extraction.netContents.value}</span>
                        )}
                        {result.extraction.governmentWarning.value ? (
                          <span className="text-green-600">Warning: found</span>
                        ) : (
                          <span className="text-red-600">Warning: not found</span>
                        )}
                      </div>
                    ) : (
                      <p className="mt-0.5 text-xs text-red-600">
                        {result.error ?? "Extraction failed"}
                      </p>
                    )}
                  </div>
                  <div className="ml-3 shrink-0">
                    {result.extraction ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white text-xs font-bold">
                        {"\u2713"}
                      </div>
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
                        {"\u2717"}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
