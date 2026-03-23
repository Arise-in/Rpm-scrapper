export interface Quality {
  resolution?: string;
  bandwidth?: number;
  framerate?: number;
  codecs?: string;
  url: string;
  proxiedUrl?: string;
}

export interface AudioTrack {
  language?: string;
  name?: string;
  default?: boolean;
  url: string;
  proxiedUrl?: string;
}

export interface Subtitle {
  language?: string;
  name?: string;
  default?: boolean;
  url: string;
  proxiedUrl?: string;
}

export interface ScraperResult {
  code: string;
  cdnBase: string | null;
  masterPlaylist: string | null;
  masterPlaylistProxy: string | null;
  qualities: Quality[];
  audioTracks: AudioTrack[];
  subtitles: Subtitle[];
  spritesheet: {
    vtt: string | null;
    vttProxy: string | null;
    image: string | null;
    imageProxy: string | null;
  };
  poster: string | null;
  posterProxy: string | null;
  thumbnail: string | null;
  thumbnailProxy: string | null;
  raw: {
    masterM3u8Content: string | null;
  };
}

const RPMPLAY_ASSET_ORIGIN = "https://anime.rpmplay.me";

const COMMON_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: `${RPMPLAY_ASSET_ORIGIN}/`,
  Origin: RPMPLAY_ASSET_ORIGIN,
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

const AES_KEY_BYTES = new Uint8Array([
  0x6b, 0x69, 0x65, 0x6d, 0x74, 0x69, 0x65, 0x6e, 0x6d, 0x75, 0x61, 0x39, 0x31,
  0x31, 0x63, 0x61,
]);
const AES_IV_BYTES = new Uint8Array([
  0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x30, 0x6f, 0x69, 0x75,
  0x79, 0x74, 0x72,
]);

async function safeFetch(url: string, options: RequestInit = {}): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...COMMON_HEADERS,
        ...((options.headers as Record<string, string> | undefined) ?? {}),
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return response.ok ? response : null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

async function fetchWithStatus(
  url: string,
  options: RequestInit = {},
  timeoutMs = 8000,
): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...COMMON_HEADERS,
        ...((options.headers as Record<string, string> | undefined) ?? {}),
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return response;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

async function headOk(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: COMMON_HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    clearTimeout(timeout);
    return false;
  }
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex string length");
  }
  const buffer = new ArrayBuffer(hex.length / 2);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < view.length; i += 1) {
    view[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return buffer;
}

async function decryptPayload(hexData: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    AES_KEY_BYTES,
    "AES-CBC",
    false,
    ["decrypt"],
  );

  const payload = hexToArrayBuffer(hexData);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv: AES_IV_BYTES },
    key,
    new Uint8Array(payload),
  );

  return new TextDecoder().decode(decrypted);
}

async function getDecryptedVideoData(code: string): Promise<Record<string, any>> {
  const response = await safeFetch(
    `${RPMPLAY_ASSET_ORIGIN}/api/v1/video?id=${code}&w=1920&h=1080&r=`,
  );

  if (!response) {
    throw new Error("Could not fetch player API");
  }

  const hexData = (await response.text()).trim();
  if (!/^[0-9a-fA-F]+$/.test(hexData)) {
    throw new Error(`Invalid API response format: ${hexData.slice(0, 100)}`);
  }

  const decryptedText = await decryptPayload(hexData);
  return JSON.parse(decryptedText);
}

function buildProxyUrl(url: string | null, baseUrl: string): string | null {
  return url && baseUrl ? `${baseUrl}/api/proxy/m3u8?url=${encodeURIComponent(url)}` : null;
}

function normalizeAssetUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;

  const trimmed = value.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    const normalized = trimmed.replace(
      /^https?:\/\/[^/]+\.streamvault\.net\/v4/i,
      RPMPLAY_ASSET_ORIGIN,
    );

    try {
      const url = new URL(normalized);
      const isIpv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(url.hostname);
      const isIpv6 = /^[0-9a-f:]+$/i.test(url.hostname) && url.hostname.includes(":");
      if (isIpv4 || isIpv6) {
        return new URL(`${url.pathname}${url.search}${url.hash}`, `${RPMPLAY_ASSET_ORIGIN}/`).href;
      }
      return url.href;
    } catch {
      return null;
    }
  }

  try {
    return new URL(trimmed, `${RPMPLAY_ASSET_ORIGIN}/`).href;
  } catch {
    return null;
  }
}

function normalizeTrackLanguage(value?: string): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeTrackName(value?: string): string {
  return (value ?? "").trim().toLowerCase();
}

function mergeSubtitle(result: ScraperResult, subtitle: Subtitle) {
  const existing = result.subtitles.find((track) => track.url === subtitle.url);

  if (existing) {
    existing.language = existing.language ?? subtitle.language;
    existing.name = existing.name ?? subtitle.name;
    existing.default = existing.default || subtitle.default;
    existing.proxiedUrl = existing.proxiedUrl ?? subtitle.proxiedUrl;
    return;
  }

  result.subtitles.push(subtitle);
}

function applyPreferredTracks(
  result: ScraperResult,
  preferredAudio?: string,
  preferredSubtitle?: string,
) {
  const audioLanguage = normalizeTrackLanguage(preferredAudio);
  if (audioLanguage) {
    let audioDefaultFound = false;
    result.audioTracks = result.audioTracks.map((track) => {
      const isDefault =
        normalizeTrackLanguage(track.language) === audioLanguage ||
        normalizeTrackName(track.name) === audioLanguage;

      if (isDefault) audioDefaultFound = true;
      return { ...track, default: isDefault || track.default };
    });

    if (!audioDefaultFound && result.audioTracks.length > 0 && !result.audioTracks.some((track) => track.default)) {
      result.audioTracks[0].default = true;
    }
  }

  const subtitleLanguage = normalizeTrackLanguage(preferredSubtitle);
  if (subtitleLanguage) {
    result.subtitles = result.subtitles.map((track) => {
      const isDefault =
        normalizeTrackLanguage(track.language) === subtitleLanguage ||
        normalizeTrackName(track.name) === subtitleLanguage;
      return { ...track, default: isDefault || track.default };
    });
  }
}

function mapSubtitlesFromApi(
  subtitleMap: Record<string, string> | undefined,
  baseUrl: string,
  preferredSubtitle?: string,
): Subtitle[] {
  if (!subtitleMap || typeof subtitleMap !== "object") return [];

  return Object.entries(subtitleMap)
    .map(([languageKey, rawValue]) => {
      const [path, fragment] = rawValue.split("#");
      const url = normalizeAssetUrl(path);
      if (!url) return null;

      const language = fragment || languageKey;
      const normalizedPreferred = normalizeTrackLanguage(preferredSubtitle);
      const normalizedLanguage = normalizeTrackLanguage(language);

      return {
        language,
        name: languageKey.toUpperCase(),
        default: Boolean(normalizedPreferred) && normalizedPreferred === normalizedLanguage,
        url,
        proxiedUrl: buildProxyUrl(url, baseUrl) ?? undefined,
      } satisfies Subtitle;
    })
    .filter(Boolean) as Subtitle[];
}

function extractCdnBase(url: string, code: string): string | null {
  if (url.includes(`/${code}/`)) {
    const index = url.lastIndexOf(`/${code}/`);
    return `${url.slice(0, index)}/${code}/`;
  }

  const lastSlash = url.lastIndexOf("/");
  return lastSlash >= 0 ? url.slice(0, lastSlash + 1) : null;
}

function resolveUrl(base: string, relative: string): string {
  if (/^https?:\/\//.test(relative)) return relative;

  try {
    return new URL(relative, base).href;
  } catch {
    const lastSlash = base.lastIndexOf("/");
    return `${lastSlash >= 0 ? base.slice(0, lastSlash + 1) : base}${relative}`;
  }
}

function parseM3u8(content: string, playlistUrl: string, result: ScraperResult, baseUrl: string) {
  const lines = content.split("\n").map((line) => line.trim());

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (line.startsWith("#EXT-X-MEDIA:")) {
      const typeMatch = line.match(/TYPE=([^,\s]+)/);
      const languageMatch = line.match(/LANGUAGE="([^"]+)"/);
      const nameMatch = line.match(/NAME="([^"]+)"/);
      const uriMatch = line.match(/URI="([^"]+)"/);
      const defaultMatch = line.match(/DEFAULT=(YES|NO)/);

      if (typeMatch && uriMatch) {
        const uri = resolveUrl(playlistUrl, uriMatch[1]);
        const trackBase = {
          language: languageMatch?.[1],
          name: nameMatch?.[1],
          default: defaultMatch?.[1] === "YES",
          url: uri,
          proxiedUrl: buildProxyUrl(uri, baseUrl) ?? undefined,
        };

        if (typeMatch[1] === "AUDIO") {
          result.audioTracks.push(trackBase);
        }

        if (typeMatch[1] === "SUBTITLES") {
          mergeSubtitle(result, trackBase);
        }
      }
    }

    if (line.startsWith("#EXT-X-STREAM-INF:")) {
      const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
      const resolutionMatch = line.match(/RESOLUTION=(\d+x\d+)/);
      const codecsMatch = line.match(/CODECS="([^"]+)"/);
      const frameRateMatch = line.match(/FRAME-RATE=([\d.]+)/);
      const nextLine = lines[index + 1];

      if (nextLine && !nextLine.startsWith("#")) {
        const url = resolveUrl(playlistUrl, nextLine);
        const height = resolutionMatch ? parseInt(resolutionMatch[1].split("x")[1], 10) : 0;

        result.qualities.push({
          resolution: height ? `${height}p` : "Source",
          bandwidth: bandwidthMatch ? parseInt(bandwidthMatch[1], 10) : undefined,
          framerate: frameRateMatch ? parseFloat(frameRateMatch[1]) : undefined,
          codecs: codecsMatch?.[1],
          url,
          proxiedUrl: buildProxyUrl(url, baseUrl) ?? undefined,
        });
      }
    }
  }

  result.qualities.sort((a, b) => (b.bandwidth ?? 0) - (a.bandwidth ?? 0));

  if (result.qualities.length === 0 && content.includes("#EXTINF")) {
    result.qualities.push({
      resolution: "Source",
      url: playlistUrl,
      proxiedUrl: buildProxyUrl(playlistUrl, baseUrl) ?? undefined,
    });
  }
}

async function hydrateSpritesheetFromVtt(result: ScraperResult, baseUrl: string) {
  if (!result.spritesheet.vtt) return;

  const response = await safeFetch(result.spritesheet.vtt);
  if (!response) return;

  const vttText = await response.text();
  const imageReferenceMatch = vttText.match(/^([^\s#\n]+\.(?:jpg|jpeg|png|webp))/im);
  if (!imageReferenceMatch) return;

  const imageUrl = resolveUrl(result.spritesheet.vtt, imageReferenceMatch[1]);
  result.spritesheet.image = imageUrl;
  result.spritesheet.imageProxy = buildProxyUrl(imageUrl, baseUrl);
}

async function discoverSubtitles(base: string, code: string, baseUrl: string): Promise<Subtitle[]> {
  const candidates = [
    { lang: "en", name: "English", path: `${base}sub/en.vtt` },
    { lang: "en", name: "English", path: `${base}sub/eng.vtt` },
    { lang: "en", name: "English", path: `${base}captions/en.vtt` },
    { lang: "en", name: "English", path: `${base}subtitles/en.vtt` },
    { lang: "en", name: "English", path: `${base}${code}.vtt` },
    { lang: "en", name: "English", path: `${base}cc.vtt` },
  ];

  const results = await Promise.all(
    candidates.map(async (candidate) => {
      const ok = await headOk(candidate.path);
      if (!ok) return null;

      return {
        language: candidate.lang,
        name: candidate.name,
        url: candidate.path,
        proxiedUrl: buildProxyUrl(candidate.path, baseUrl) ?? undefined,
      } satisfies Subtitle;
    }),
  );

  return results.filter(Boolean) as Subtitle[];
}

async function discoverSpritesheet(base: string, result: ScraperResult, baseUrl: string) {
  const vttNames = ["thumbnail.vtt", "thumbnails.vtt", "sprite.vtt", "thumbs.vtt", "storyboard.vtt"];
  const imageNames = ["thumbnail.jpg", "thumbnails.jpg", "sprite.jpg", "thumbs.jpg"];

  const probes = [
    ...vttNames.map((name) => ({ type: "vtt" as const, url: `${base}${name}` })),
    ...imageNames.map((name) => ({ type: "image" as const, url: `${base}${name}` })),
  ];

  const results = await Promise.all(
    probes.map(async (probe) => ({
      ...probe,
      ok: await headOk(probe.url),
    })),
  );

  const vttMatch = results.find((probe) => probe.type === "vtt" && probe.ok);
  const imageMatch = results.find((probe) => probe.type === "image" && probe.ok);

  if (vttMatch) {
    result.thumbnail = vttMatch.url;
    result.thumbnailProxy = buildProxyUrl(vttMatch.url, baseUrl);
    result.spritesheet.vtt = vttMatch.url;
    result.spritesheet.vttProxy = buildProxyUrl(vttMatch.url, baseUrl);
  }

  if (imageMatch) {
    result.spritesheet.image = imageMatch.url;
    result.spritesheet.imageProxy = buildProxyUrl(imageMatch.url, baseUrl);
  }

  if (result.spritesheet.vtt && !result.spritesheet.image) {
    await hydrateSpritesheetFromVtt(result, baseUrl);
  }
}

export async function scrapeRpmVideo(code: string, baseUrl = ""): Promise<ScraperResult> {
  const result: ScraperResult = {
    code,
    cdnBase: null,
    masterPlaylist: null,
    masterPlaylistProxy: null,
    qualities: [],
    audioTracks: [],
    subtitles: [],
    spritesheet: {
      vtt: null,
      vttProxy: null,
      image: null,
      imageProxy: null,
    },
    poster: null,
    posterProxy: null,
    thumbnail: null,
    thumbnailProxy: null,
    raw: {
      masterM3u8Content: null,
    },
  };

  let videoData: Record<string, any>;
  try {
    videoData = await getDecryptedVideoData(code);
  } catch (error: any) {
    throw new Error(`Failed to decrypt video data: ${error.message}`);
  }

  const masterUrl = normalizeAssetUrl(videoData.source);
  if (!masterUrl) {
    throw new Error("No source URL found in decrypted API response");
  }

  result.poster = normalizeAssetUrl(videoData.poster);
  result.posterProxy = buildProxyUrl(result.poster, baseUrl);

  result.thumbnail = normalizeAssetUrl(videoData.thumbnail);
  result.thumbnailProxy = buildProxyUrl(result.thumbnail, baseUrl);
  result.spritesheet.vtt = result.thumbnail;
  result.spritesheet.vttProxy = result.thumbnailProxy;

  const subtitlesFromApi = mapSubtitlesFromApi(
    videoData.subtitle,
    baseUrl,
    videoData.player?.defaultSubtitle,
  );

  for (const subtitle of subtitlesFromApi) {
    mergeSubtitle(result, subtitle);
  }

  result.cdnBase = extractCdnBase(masterUrl, code);
  result.masterPlaylist = masterUrl;
  result.masterPlaylistProxy = buildProxyUrl(masterUrl, baseUrl);

  const masterResponse = await fetchWithStatus(masterUrl);
  if (!masterResponse) {
    throw new Error("Could not fetch the decrypted master playlist URL (network error)");
  }
  if (!masterResponse.ok) {
    const masterHost = (() => {
      try {
        return new URL(masterUrl).host;
      } catch {
        return "unknown";
      }
    })();
    const snippet = await masterResponse.text().catch(() => "");
    const trimmed = snippet.trim();
    const hint = trimmed ? ` Response: ${trimmed.slice(0, 120)}` : "";
    throw new Error(
      `Could not fetch the decrypted master playlist URL (status ${masterResponse.status}). Host: ${masterHost}.${hint}`,
    );
  }

  const masterContent = await masterResponse.text();
  result.raw.masterM3u8Content = masterContent;

  parseM3u8(masterContent, masterUrl, result, baseUrl);
  applyPreferredTracks(result, videoData.player?.defaultAudio, videoData.player?.defaultSubtitle);

  if (result.cdnBase) {
    const discoveredSubtitles = await discoverSubtitles(result.cdnBase, code, baseUrl);
    for (const subtitle of discoveredSubtitles) {
      mergeSubtitle(result, subtitle);
    }
  }

  if (result.spritesheet.vtt) {
    await hydrateSpritesheetFromVtt(result, baseUrl);
  } else if (result.cdnBase) {
    await discoverSpritesheet(result.cdnBase, result, baseUrl);
  }

  return result;
}
