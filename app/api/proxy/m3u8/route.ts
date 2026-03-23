import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://aniflix.rpmvid.com/",
  Origin: "https://aniflix.rpmvid.com",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const response = await fetch(targetUrl, { headers: REQUEST_HEADERS });
  if (!response.ok) {
    return NextResponse.json(
      { error: `Upstream fetch failed: ${response.status}` },
      { status: response.status },
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  const proxyOrigin = new URL(request.url).origin;
  const isM3u8 =
    targetUrl.endsWith(".m3u8") ||
    targetUrl.includes(".txt") ||
    contentType.includes("mpegurl") ||
    contentType.includes("m3u8");
  const isVtt = targetUrl.endsWith(".vtt") || contentType.includes("text/vtt") || contentType.includes("text/plain");

  if (isM3u8) {
    const playlistText = await response.text();

    if (!playlistText.includes("#EXTM3U")) {
      return new NextResponse(playlistText, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const rewrittenPlaylist = rewriteM3u8(playlistText, targetUrl, proxyOrigin);
    return new NextResponse(rewrittenPlaylist, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  if (isVtt) {
    const vttText = await response.text();
    const rewrittenVtt = vttText.includes("WEBVTT")
      ? rewriteVtt(vttText, targetUrl, proxyOrigin)
      : vttText;

    return new NextResponse(rewrittenVtt, {
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  const body = await response.arrayBuffer();
  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function rewriteM3u8(content: string, baseUrl: string, proxyOrigin: string): string {
  const lines = content.split("\n");
  const baseUri = baseUrl.slice(0, baseUrl.lastIndexOf("/") + 1);

  return lines
    .map((line) => {
      const trimmed = line.trim();

      if (trimmed.startsWith("#") && !trimmed.includes("URI=")) {
        return line;
      }

      if (
        trimmed.startsWith("#EXT-X-MEDIA") ||
        trimmed.startsWith("#EXT-X-MAP") ||
        trimmed.startsWith("#EXT-X-KEY") ||
        trimmed.startsWith("#EXT-X-SESSION-DATA") ||
        trimmed.startsWith("#EXT-X-I-FRAME-STREAM-INF")
      ) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
          const absoluteUrl = resolveUrl(baseUri, uri);
          return `URI="${proxyOrigin}/api/proxy/m3u8?url=${encodeURIComponent(absoluteUrl)}"`;
        });
      }

      if (trimmed && !trimmed.startsWith("#")) {
        const absoluteUrl = resolveUrl(baseUri, trimmed);
        return `${proxyOrigin}/api/proxy/m3u8?url=${encodeURIComponent(absoluteUrl)}`;
      }

      return line;
    })
    .join("\n");
}

function rewriteVtt(content: string, baseUrl: string, proxyOrigin: string): string {
  return content
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      const imageMatch = trimmed.match(/^([^\s]+\.(?:jpg|jpeg|png|webp))(#[^\s]+)?$/i);

      if (!imageMatch) {
        return line;
      }

      const absoluteImageUrl = resolveUrl(baseUrl, imageMatch[1]);
      const proxiedImageUrl = `${proxyOrigin}/api/proxy/m3u8?url=${encodeURIComponent(absoluteImageUrl)}`;
      return `${proxiedImageUrl}${imageMatch[2] ?? ""}`;
    })
    .join("\n");
}

function resolveUrl(base: string, relative: string): string {
  if (/^https?:\/\//.test(relative)) return relative;

  try {
    return new URL(relative, base).href;
  } catch {
    return `${base}${relative}`;
  }
}
