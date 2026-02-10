import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">How It Works</h1>
        <p className="mt-1 text-gray-600">
          This tool uses AI-powered OCR to help compliance agents verify alcohol
          labels faster and more accurately.
        </p>
      </div>

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
            accepts JPEG, PNG, and WebP images. For best results, use a flat,
            well-lit scan rather than an angled photo.
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
            sharpening) and runs OCR to extract all text from the label. Fields
            like brand name, ABV, net contents, and the government warning are
            identified automatically.
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
            each field using fuzzy matching (for text), numeric normalization
            (for ABV and volume), and exact validation (for the government
            warning). Results show pass/fail per field with confidence scores.
          </CardContent>
        </Card>
      </div>

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
            <strong>Fuzzy Matching:</strong> Text fields like brand name and
            class/type are compared using case-insensitive, punctuation-normalized
            similarity scoring. This handles real-world differences like
            &quot;STONE&apos;S THROW&quot; vs &quot;Stone&apos;s Throw&quot; without
            false failures.
          </p>
          <p>
            <strong>Government Warning:</strong> Validated with exact prefix
            check (&quot;GOVERNMENT WARNING:&quot; must be in all caps) plus
            content matching for both required sentences. Minor OCR artifacts are
            tolerated, but formatting violations are caught.
          </p>
          <p>
            <strong>Performance:</strong> Target is under 5 seconds
            end-to-end. The OCR worker pool stays warm between requests for
            sub-second processing after initial load.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
