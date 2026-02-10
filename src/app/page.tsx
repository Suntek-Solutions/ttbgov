"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LabelUploader } from "@/components/LabelUploader";
import { ApplicationForm } from "@/components/ApplicationForm";
import { ExtractedFields } from "@/components/ExtractedFields";
import { VerificationResults } from "@/components/VerificationResults";
import type {
  ApplicationData,
  ExtractedFields as ExtractedFieldsType,
  ExtractResponse,
  VerifyResponse,
} from "@/lib/types";

type Step = "upload" | "extracted" | "results";

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
  const [extractedFields, setExtractedFields] = useState<ExtractedFieldsType | null>(null);
  const [extractTime, setExtractTime] = useState(0);
  const [applicationData, setApplicationData] = useState<ApplicationData>(EMPTY_APPLICATION);
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Extract text from uploaded label image
  const handleExtract = async () => {
    if (!selectedFile) return;

    setIsExtracting(true);
    setError(null);

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
        return;
      }

      setExtractedFields(data.fields);
      setExtractTime(data.processingTimeMs);
      setStep("extracted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error during extraction.");
    } finally {
      setIsExtracting(false);
    }
  };

  // Step 2: Verify extracted fields against application data
  const handleVerify = async () => {
    if (!extractedFields) return;

    setIsVerifying(true);
    setError(null);

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
        return;
      }

      setVerifyResult(data);
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error during verification.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Reset to start over
  const handleReset = () => {
    setStep("upload");
    setSelectedFile(null);
    setExtractedFields(null);
    setExtractTime(0);
    setApplicationData(EMPTY_APPLICATION);
    setVerifyResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Label Verification
        </h1>
        <p className="mt-1 text-gray-600">
          Upload a label image, enter the application data, and verify they match.
        </p>
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      {/* Step 1: Upload and Extract */}
      <Card>
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
            onImageSelected={(file) => {
              setSelectedFile(file);
              // Reset downstream state if re-uploading
              if (step !== "upload") {
                setExtractedFields(null);
                setVerifyResult(null);
                setStep("upload");
              }
            }}
            isProcessing={isExtracting}
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

      {/* Step 2: Review extracted fields + enter application data */}
      {step !== "upload" && extractedFields && (
        <>
          <Separator />

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: Extracted fields from OCR */}
            <ExtractedFields
              fields={extractedFields}
              processingTimeMs={extractTime}
            />

            {/* Right: Application data form */}
            <ApplicationForm
              data={applicationData}
              onChange={setApplicationData}
              disabled={isVerifying}
            />
          </div>

          {step === "extracted" && (
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
              {isVerifying ? "Verifying..." : "Verify Label Against Application"}
            </Button>
          )}
        </>
      )}

      {/* Step 3: Verification Results */}
      {step === "results" && verifyResult && (
        <>
          <Separator />

          <VerificationResults
            overall={verifyResult.overall!}
            results={verifyResult.results!}
            processingTimeMs={verifyResult.processingTimeMs}
          />

          <Button
            onClick={handleReset}
            variant="outline"
            size="lg"
            className="w-full text-base"
          >
            Verify Another Label
          </Button>
        </>
      )}
    </div>
  );
}
