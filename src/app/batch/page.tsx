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
import { ExampleLabelPicker } from "@/components/ExampleLabelPicker";
import type { ExtractedFields } from "@/lib/types";

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

  const handleBatchDemoSelect = (demoFiles: File[]) => {
    setFiles(demoFiles);
    setResults([]);
    setProgress(0);
    setError(null);
    if (demoMode) addLog(`Loaded ${demoFiles.length} demo labels for batch processing`);
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
          {/* Demo mode: label picker for batch */}
          {demoMode && files.length === 0 && (
            <ExampleLabelPicker
              mode="batch"
              onSelect={() => {}}
              onBatchSelect={(demoFiles) => handleBatchDemoSelect(demoFiles)}
            />
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
              {results.map((result, i) => {
                if (!result.extraction) {
                  return (
                    <div key={i} className="flex items-center justify-between px-4 py-3 bg-red-50">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{result.filename}</p>
                        <p className="mt-0.5 text-xs text-red-600">{result.error ?? "Extraction failed"}</p>
                      </div>
                      <div className="ml-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">{"\u2717"}</div>
                    </div>
                  );
                }

                const ext = result.extraction;
                const fieldsFound = [ext.brandName, ext.classType, ext.alcoholContent, ext.netContents, ext.governmentWarning, ext.producerInfo, ext.countryOfOrigin]
                  .filter(f => f.value).length;

                return (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate">{result.filename}</p>
                      <span className="ml-2 shrink-0 text-xs text-gray-400">{fieldsFound}/7 fields</span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      {/* Brand */}
                      <div className="flex items-center gap-1.5">
                        <span className={ext.brandName.value ? "text-green-600" : "text-gray-300"}>{ext.brandName.value ? "\u2713" : "\u2013"}</span>
                        <span className="text-gray-500">Brand:</span>
                        <span className={`truncate ${ext.brandName.value ? "text-gray-800" : "text-gray-400 italic"}`}>
                          {ext.brandName.value ? ext.brandName.value.substring(0, 30) : "not detected"}
                        </span>
                      </div>
                      {/* Type */}
                      <div className="flex items-center gap-1.5">
                        <span className={ext.classType.value ? "text-green-600" : "text-gray-300"}>{ext.classType.value ? "\u2713" : "\u2013"}</span>
                        <span className="text-gray-500">Type:</span>
                        <span className={`truncate ${ext.classType.value ? "text-gray-800" : "text-gray-400 italic"}`}>
                          {ext.classType.value ?? "not detected"}
                        </span>
                      </div>
                      {/* ABV */}
                      <div className="flex items-center gap-1.5">
                        <span className={ext.alcoholContent.value ? "text-green-600" : "text-gray-300"}>{ext.alcoholContent.value ? "\u2713" : "\u2013"}</span>
                        <span className="text-gray-500">ABV:</span>
                        <span className={`${ext.alcoholContent.value ? "text-gray-800" : "text-gray-400 italic"}`}>
                          {ext.alcoholContent.value ?? "not detected"}
                        </span>
                      </div>
                      {/* Volume */}
                      <div className="flex items-center gap-1.5">
                        <span className={ext.netContents.value ? "text-green-600" : "text-gray-300"}>{ext.netContents.value ? "\u2713" : "\u2013"}</span>
                        <span className="text-gray-500">Vol:</span>
                        <span className={`${ext.netContents.value ? "text-gray-800" : "text-gray-400 italic"}`}>
                          {ext.netContents.value ?? "not detected"}
                        </span>
                      </div>
                      {/* Warning -- full row */}
                      <div className="col-span-2 flex items-center gap-1.5">
                        {ext.governmentWarning.value ? (
                          <>
                            <span className="text-green-600">{"\u2713"}</span>
                            <span className="text-gray-500">Gov. Warning:</span>
                            <span className="text-gray-800">present on label</span>
                          </>
                        ) : (
                          <>
                            <span className="text-red-500 font-bold">{"\u2717"}</span>
                            <span className="text-gray-500">Gov. Warning:</span>
                            <span className="text-red-600 font-medium">NOT detected on label</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
