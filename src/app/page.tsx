"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LabelUploader } from "@/components/LabelUploader";
import { LabelComparisonView } from "@/components/LabelComparisonView";
import { VerificationResults } from "@/components/VerificationResults";
import { ExampleLabelPicker } from "@/components/ExampleLabelPicker";
import { useDemo } from "@/lib/demo-context";
import type {
  ApplicationData,
  ExtractedFields as ExtractedFieldsType,
  ExtractResponse,
  VerifyResponse,
} from "@/lib/types";

type Step = "upload" | "extracted" | "results";

function LabelImageReference({
  src,
  filename,
  extractTime,
}: {
  src: string;
  filename: string;
  extractTime: number;
}) {
  const [enlarged, setEnlarged] = useState(false);

  return (
    <>
      <div className="rounded-lg border bg-white p-3">
        <p className="mb-2 text-xs font-medium text-gray-500">
          Label Reference -- click to enlarge
        </p>
        <button
          onClick={() => setEnlarged(true)}
          className="group relative w-full overflow-hidden rounded-lg border transition-shadow hover:shadow-md"
        >
          <Image
            src={src}
            alt="Uploaded label"
            width={400}
            height={280}
            className="w-full object-contain"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/10">
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-700 opacity-0 shadow transition-opacity group-hover:opacity-100">
              Click to enlarge
            </span>
          </div>
        </button>
        <p className="mt-2 text-xs text-gray-500">
          {filename} -- extracted in {extractTime}ms
        </p>
      </div>

      {/* Lightbox overlay */}
      {enlarged && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 cursor-pointer"
          onClick={() => setEnlarged(false)}
        >
          <div
            className="relative flex flex-col items-center p-6"
            style={{ maxWidth: "92vw", maxHeight: "92vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt="Label full view"
              style={{
                maxHeight: "82vh",
                maxWidth: "88vw",
                width: "auto",
                height: "auto",
                objectFit: "contain",
              }}
              className="rounded-lg shadow-2xl bg-white"
            />
            <button
              onClick={() => setEnlarged(false)}
              className="absolute top-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-xl text-white hover:bg-black/80 z-10"
            >
              &times;
            </button>
            <p className="mt-3 text-center text-sm text-white/70">{filename} -- click outside or X to close</p>
          </div>
        </div>
      )}
    </>
  );
}

const EMPTY_APPLICATION: ApplicationData = {
  brandName: "",
  classType: "",
  alcoholContent: "",
  netContents: "",
  governmentWarning: "",
  producerInfo: "",
  countryOfOrigin: "",
};

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedFields, setExtractedFields] = useState<ExtractedFieldsType | null>(null);
  const [extractTime, setExtractTime] = useState(0);
  const [applicationData, setApplicationData] = useState<ApplicationData>(EMPTY_APPLICATION);
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoPrefill, setDemoPrefill] = useState<ApplicationData | null>(null);
  const { demoMode, addLog } = useDemo();
  const uploaderRef = useRef<HTMLDivElement>(null);

  const handleImageSelected = (file: File, prefillData?: ApplicationData, rawUrl?: string) => {
    setSelectedFile(file);
    setImagePreview(rawUrl ?? URL.createObjectURL(file));
    if (demoMode) addLog(`Image selected: ${file.name} (${(file.size / 1024).toFixed(0)}KB)`);
    // Reset downstream state
    setExtractedFields(null);
    setVerifyResult(null);
    setStep("upload");
    setError(null);
    // Pre-fill application data if provided; keep existing demoPrefill if no new data
    if (prefillData) {
      setApplicationData(prefillData);
      setDemoPrefill(prefillData);
      if (demoMode) addLog("Application data pre-filled from demo example");
    }
    // Scroll to uploader to show the selected label
    setTimeout(() => {
      uploaderRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
  };

  const handleExtract = async () => {
    if (!selectedFile) return;

    setIsExtracting(true);
    setError(null);
    if (demoMode) addLog(`Starting OCR extraction for ${selectedFile.name}...`);

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);

      const res = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      const data: ExtractResponse = await res.json();

      if (!data.success || !data.fields) {
        setError(data.error ?? "Extraction failed.");
        if (demoMode) addLog(`ERROR: Extraction failed -- ${data.error}`);
        return;
      }

      setExtractedFields(data.fields);
      setExtractTime(data.processingTimeMs);
      setStep("extracted");

      if (demoMode) {
        addLog(`OCR complete in ${data.processingTimeMs}ms`);
        const fieldCount = Object.entries(data.fields)
          .filter(([k, v]) => k !== "rawText" && (v as { value: string | null }).value)
          .length;
        addLog(`Extracted ${fieldCount}/7 fields`);
        if (data.fields.governmentWarning.value) {
          addLog("Government warning: FOUND");
        } else {
          addLog("Government warning: NOT FOUND on label");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error during extraction.");
      if (demoMode) addLog(`ERROR: ${err instanceof Error ? err.message : "Network error"}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleVerify = async () => {
    if (!extractedFields) return;

    setIsVerifying(true);
    setError(null);
    if (demoMode) addLog("Starting verification...");

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extracted: extractedFields,
          application: applicationData,
        }),
      });

      const data: VerifyResponse = await res.json();

      if (!data.success) {
        setError(data.error ?? "Verification failed.");
        if (demoMode) addLog(`ERROR: Verification failed -- ${data.error}`);
        return;
      }

      setVerifyResult(data);
      // Stay on "extracted" step so form remains editable for re-verification

      if (demoMode) {
        addLog(`Verification complete in ${data.processingTimeMs}ms -- ${data.overall?.toUpperCase()}`);
        data.results?.forEach((r) => {
          addLog(`  ${r.match ? "PASS" : "FAIL"} ${r.field}: ${r.details}`);
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error during verification.");
      if (demoMode) addLog(`ERROR: ${err instanceof Error ? err.message : "Network error"}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleReset = () => {
    setStep("upload");
    setSelectedFile(null);
    setImagePreview(null);
    setExtractedFields(null);
    setExtractTime(0);
    setApplicationData(EMPTY_APPLICATION);
    setDemoPrefill(null);
    setVerifyResult(null);
    setError(null);
    if (demoMode) addLog("Reset -- ready for new label");
  };

  return (
    <div className={`space-y-6 ${demoMode ? "pb-[180px]" : ""}`}>
      {/* Page title + New Label button */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Label Verification
          </h1>
          <p className="mt-1 text-gray-600">
            Upload a label image, enter the application data, and verify they match.
          </p>
        </div>
        {step !== "upload" && (
          <Button onClick={handleReset} variant="outline" size="lg">
            New Label
          </Button>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      {/* Demo mode: example label picker (always visible in demo) */}
      {demoMode && (
        <ExampleLabelPicker onSelect={handleImageSelected} />
      )}

      {/* Step 1: Upload and Extract */}
      {step === "upload" && (
        <Card ref={uploaderRef}>
          <CardHeader>
            <CardTitle className="text-base">
              Step 1: Upload Label Image
            </CardTitle>
            <CardDescription>
              Upload a photo or scan of the alcohol label. The AI will extract text from the image.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
          <LabelUploader
            onImageSelected={(file) => handleImageSelected(file)}
            isProcessing={isExtracting}
            externalPreview={imagePreview}
            externalFileName={selectedFile?.name || null}
          />
            <Button
              onClick={handleExtract}
              disabled={!selectedFile || isExtracting}
              size="lg"
              className="w-full text-base"
            >
              {isExtracting ? "Extracting text from label..." : "Extract Label Text"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Compare extracted fields with application data */}
      {step !== "upload" && extractedFields && (
        <>
          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            {/* Main: Integrated comparison view */}
            <LabelComparisonView
              extracted={extractedFields}
              applicationData={applicationData}
              onChange={setApplicationData}
              verifyResults={verifyResult?.results ?? undefined}
              disabled={isVerifying}
              demoFillData={demoMode ? demoPrefill : null}
              processingTimeMs={extractTime}
            />

            {/* Side: Label image reference */}
            <div className="space-y-3">
              {imagePreview && (
                <LabelImageReference
                  src={imagePreview}
                  filename={selectedFile?.name ?? "label"}
                  extractTime={extractTime}
                />
              )}
            </div>
          </div>

          {/* Verify button -- always visible when we have extracted fields */}
          <Button
            onClick={handleVerify}
            disabled={
              isVerifying ||
              !applicationData.brandName ||
              !applicationData.classType ||
              !applicationData.alcoholContent ||
              !applicationData.netContents ||
              !applicationData.governmentWarning
            }
            size="lg"
            className="w-full text-base"
          >
            {isVerifying
              ? "Verifying..."
              : verifyResult
              ? "Re-Verify With Updated Data"
              : "Verify Label Against Application"}
          </Button>

          {/* Verification summary */}
          {verifyResult && (
            <div className={`rounded-lg border-2 p-4 text-center ${
              verifyResult.overall === "pass"
                ? "border-green-300 bg-green-50"
                : "border-red-300 bg-red-50"
            }`}>
              <span className={`text-lg font-bold ${
                verifyResult.overall === "pass" ? "text-green-700" : "text-red-700"
              }`}>
                {verifyResult.overall === "pass" ? "ALL FIELDS MATCH" : "VERIFICATION FAILED"}
              </span>
              <span className="ml-2 text-sm text-gray-500">
                ({verifyResult.results?.filter(r => r.match).length}/{verifyResult.results?.length} pass -- {verifyResult.processingTimeMs}ms)
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
