import { NextRequest, NextResponse } from "next/server";
import { scrapeRpmVideo } from "../../../lib/scraper";

type RouteParams = Record<string, string | string[] | undefined>;
type CodeRouteHandlerContext = {
  params: Promise<RouteParams>;
};

export const config = {
  api: {
    responseLimit: "8mb",
  },
};

export async function GET(
  request: NextRequest,
  context: CodeRouteHandlerContext
) {
  const params = (await context.params) ?? {};
  const rawCode = params.code;
  const code = Array.isArray(rawCode) ? rawCode[0] : rawCode;

  if (!code) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  // Get the base URL of this deployment so we can build /api/proxy/m3u8 URLs
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  try {
    const data = await scrapeRpmVideo(code, baseUrl);
    
    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to scrape video data";
    console.error("Scraping error:", error);
    return NextResponse.json({ error: msg }, {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
}

export async function OPTIONS(
  _request: NextRequest,
  _context: CodeRouteHandlerContext
) {
  return NextResponse.json({}, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    }
  });
}
