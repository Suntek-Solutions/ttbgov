"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function BatchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Batch Upload</h1>
        <p className="mt-1 text-gray-600">
          Process multiple label images at once for high-volume importers.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coming in Step 8</CardTitle>
          <CardDescription>
            Batch upload with multi-file selection, progress indicators, and
            summary results table. The API endpoint (/api/batch) is already
            built and tested.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-gray-600">
          <p>
            This page will support uploading 50+ labels at once with parallel
            processing and a progress bar showing completion status.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
