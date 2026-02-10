/**
 * POST /api/verify
 *
 * Accepts extracted label fields + application data,
 * returns field-by-field verification results.
 *
 * Request: JSON body with { extracted: ExtractedFields, application: ApplicationData }
 * Response: VerifyResponse (see src/lib/types.ts)
 */

import { NextRequest, NextResponse } from "next/server";
import { compareFields } from "@/lib/verification/comparator";
import type { VerifyRequest, VerifyResponse } from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse<VerifyResponse>> {
  const start = performance.now();

  try {
    const body = (await request.json()) as VerifyRequest;

    // Validate request body
    if (!body.extracted || !body.application) {
      return NextResponse.json(
        {
          success: false,
          error: "Request must include 'extracted' and 'application' fields.",
          processingTimeMs: Math.round(performance.now() - start),
        },
        { status: 400 }
      );
    }

    // Validate required application fields
    const required = [
      "brandName",
      "classType",
      "alcoholContent",
      "netContents",
      "governmentWarning",
    ] as const;

    for (const field of required) {
      if (!body.application[field]) {
        return NextResponse.json(
          {
            success: false,
            error: `Missing required application field: '${field}'.`,
            processingTimeMs: Math.round(performance.now() - start),
          },
          { status: 400 }
        );
      }
    }

    // Run verification
    const result = compareFields(body.extracted, body.application);

    return NextResponse.json({
      success: true,
      overall: result.overall,
      results: result.results,
      processingTimeMs: Math.round(performance.now() - start),
    });
  } catch (error) {
    console.error("[/api/verify] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred during verification.",
        processingTimeMs: Math.round(performance.now() - start),
      },
      { status: 500 }
    );
  }
}
