import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AboutPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">How It Works</h1>
        <p className="mt-1 text-gray-600">
          This tool uses AI-powered OCR to help compliance agents verify alcohol
          labels faster and more accurately.
        </p>
      </div>

      {/* 3-Step Flow */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-lg font-bold text-blue-700">
              1
            </div>
            <CardTitle className="text-base">Upload Label</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600">
            Upload a photo or scan of an alcohol beverage label. The system
            accepts JPEG, PNG, and WebP images up to 10MB. For best results, use
            a flat, well-lit scan rather than an angled photo. Drag-and-drop or
            click to browse.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-lg font-bold text-blue-700">
              2
            </div>
            <CardTitle className="text-base">AI Extracts Text</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600">
            The AI preprocesses the image (grayscale, contrast enhancement,
            sharpening) and runs OCR to extract all text from the label. Seven
            standard fields are identified automatically and displayed with
            confidence scores so you can see what the AI found.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-lg font-bold text-blue-700">
              3
            </div>
            <CardTitle className="text-base">Verify Match</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600">
            Enter the application data and click Verify. The system compares
            each field using the appropriate strategy and shows a clear
            pass/fail result per field with confidence scores. You make the
            final call.
          </CardContent>
        </Card>
      </div>

      {/* Fields Verified */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fields Verified</CardTitle>
          <p className="text-sm text-gray-500">
            The following label fields are extracted and compared against
            application data. Each field uses the comparison method best suited
            to its content.
          </p>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            <div className="flex items-start gap-3 py-3">
              <Badge variant="outline" className="mt-0.5 shrink-0">fuzzy</Badge>
              <div>
                <p className="text-sm font-medium text-gray-900">Brand Name</p>
                <p className="text-sm text-gray-600">
                  Case-insensitive fuzzy match. Handles differences like
                  &quot;STONE&apos;S THROW&quot; vs &quot;Stone&apos;s Throw&quot;
                  without false failures.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-3">
              <Badge variant="outline" className="mt-0.5 shrink-0">fuzzy</Badge>
              <div>
                <p className="text-sm font-medium text-gray-900">Class / Type Designation</p>
                <p className="text-sm text-gray-600">
                  Matched against 40+ known designations (bourbon, rye, gin,
                  cabernet sauvignon, IPA, etc.) with fuzzy text comparison.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-3">
              <Badge variant="outline" className="mt-0.5 shrink-0">numeric</Badge>
              <div>
                <p className="text-sm font-medium text-gray-900">Alcohol Content (ABV)</p>
                <p className="text-sm text-gray-600">
                  Extracts the numeric percentage and compares values regardless
                  of formatting. &quot;45% Alc./Vol. (90 Proof)&quot; and
                  &quot;45%&quot; both resolve to 45 for comparison.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-3">
              <Badge variant="outline" className="mt-0.5 shrink-0">numeric</Badge>
              <div>
                <p className="text-sm font-medium text-gray-900">Net Contents</p>
                <p className="text-sm text-gray-600">
                  Extracts volume and unit, normalizes across formats.
                  &quot;750 mL&quot; and &quot;750mL&quot; are treated as equal.
                  Supports mL, L, and oz with unit conversion.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-3">
              <Badge variant="outline" className="mt-0.5 shrink-0">exact</Badge>
              <div>
                <p className="text-sm font-medium text-gray-900">Government Health Warning Statement</p>
                <p className="text-sm text-gray-600">
                  Strict 4-check validation: (1) warning text is present, (2)
                  &quot;GOVERNMENT WARNING:&quot; prefix is in ALL CAPS, (3) both
                  required sentences are present (pregnancy/birth defects and
                  machinery/health problems), (4) body text matches the standard
                  1988 wording. Minor OCR artifacts tolerated; formatting
                  violations caught.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-3">
              <Badge variant="outline" className="mt-0.5 shrink-0">fuzzy</Badge>
              <div>
                <p className="text-sm font-medium text-gray-900">Name and Address of Bottler/Producer</p>
                <p className="text-sm text-gray-600">
                  Optional field. Matches &quot;Distilled by...&quot;,
                  &quot;Bottled by...&quot;, &quot;Produced by...&quot;,
                  &quot;Imported by...&quot; and similar patterns with fuzzy
                  text comparison.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-3">
              <Badge variant="outline" className="mt-0.5 shrink-0">fuzzy</Badge>
              <div>
                <p className="text-sm font-medium text-gray-900">Country of Origin</p>
                <p className="text-sm text-gray-600">
                  Optional field for imports. Matches &quot;Product of
                  USA&quot;, &quot;Product of France&quot;, etc. with fuzzy text
                  comparison.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Technical Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Technical Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <p>
            <strong>OCR Engine:</strong> Tesseract.js (LSTM neural network) runs
            entirely on the server. No data is sent to external cloud APIs -- all
            processing is local, which means this tool works behind any firewall.
          </p>
          <p>
            <strong>Image Preprocessing:</strong> Before OCR, every image goes
            through a pipeline: resize to consistent resolution, grayscale
            conversion, contrast normalization, and gentle sharpening. This
            improves accuracy on photos that are slightly blurry, low-contrast,
            or poorly lit.
          </p>
          <p>
            <strong>Fuzzy Matching:</strong> Text fields like brand name and
            class/type are compared using case-insensitive, punctuation-normalized
            similarity scoring with a configurable threshold (default 85%). This
            handles real-world differences without false failures while still
            catching genuine mismatches.
          </p>
          <p>
            <strong>Government Warning:</strong> Validated separately from other
            fields with a dedicated 4-check validator. The prefix
            &quot;GOVERNMENT WARNING:&quot; must be in all caps -- title case like
            &quot;Government Warning:&quot; is rejected, as required by TTB
            regulations.
          </p>
          <p>
            <strong>Performance:</strong> Target is under 5 seconds
            end-to-end. The OCR worker pool (2 persistent workers) stays warm
            between requests for sub-second processing after initial load.
            Image preprocessing adds ~150ms but significantly improves OCR
            accuracy.
          </p>
          <p>
            <strong>Batch Processing:</strong> The batch upload page processes
            multiple labels in parallel (3 at a time) with real-time progress
            tracking. Designed for the high-volume importers who submit 200-300
            label applications at once.
          </p>
        </CardContent>
      </Card>

      {/* Known Limitations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Known Limitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <p>
            <strong>Decorative Fonts:</strong> Brand names printed in highly
            stylized or decorative fonts may not be readable by the OCR engine.
            When this happens, the tool shows &quot;not found&quot; for the
            brand name field rather than guessing incorrectly. The agent can
            verify the brand name visually.
          </p>
          <p>
            <strong>Image Quality:</strong> Best results come from flat,
            well-lit scans or photos. Heavily angled shots, extreme glare, or
            very low resolution images may produce lower confidence scores or
            incomplete extraction.
          </p>
          <p>
            <strong>English Only:</strong> The OCR engine is configured for
            English text only, which covers all TTB-regulated domestic labels.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
