"use client";

import { useCallback, useState } from "react";
import Image from "next/image";

interface LabelUploaderProps {
  onImageSelected: (file: File) => void;
  isProcessing?: boolean;
  externalPreview?: string | null;
  externalFileName?: string | null;
}

export function LabelUploader({ onImageSelected, isProcessing, externalPreview, externalFileName }: LabelUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  
  // Use external preview/filename if provided, otherwise use internal state
  const displayPreview = externalPreview || preview;
  const displayFileName = externalFileName || fileName;

  const handleFile = useCallback(
    (file: File) => {
      setFileError(null);
      if (!file.type.startsWith("image/")) {
        setFileError(
          `"${file.name}" is not a supported image format. Please upload a JPEG, PNG, or WebP file.`
        );
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setFileError(
          `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum file size is 10MB.`
        );
        return;
      }
      setFileName(file.name);
      setPreview(URL.createObjectURL(file));
      onImageSelected(file);
    },
    [onImageSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700">Label Image</label>

      {/* Inline error message */}
      {fileError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{fileError}</p>
        </div>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        className={`relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
          isDragOver
            ? "border-blue-500 bg-blue-50"
            : displayPreview
            ? "border-green-300 bg-green-50"
            : fileError
            ? "border-red-300 bg-red-50/30"
            : "border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/50"
        } ${isProcessing ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="absolute inset-0 cursor-pointer opacity-0"
          disabled={isProcessing}
        />
        {displayPreview ? (
          <div className="flex flex-col items-center gap-3 p-4">
            <Image
              src={displayPreview}
              alt="Label preview"
              width={300}
              height={200}
              className="max-h-[180px] w-auto rounded-lg object-contain shadow-sm"
              unoptimized={!!externalPreview}
            />
            <p className="text-sm text-gray-600">
              {displayFileName} -- click or drop to replace
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <svg
                className="h-6 w-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-base font-medium text-gray-700">
              Drop a label image here, or click to browse
            </p>
            <p className="text-sm text-gray-500">
              JPEG, PNG, or WebP -- up to 10MB
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
