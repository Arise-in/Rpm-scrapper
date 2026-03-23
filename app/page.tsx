"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import "vidstack/player/styles/base.css";
import "vidstack/player/styles/default/theme.css";
import "vidstack/player/styles/default/layouts/video.css";
import {
  MediaPlayer,
  MediaProvider,
  Track,
  type MediaPlayerInstance,
} from "@vidstack/react";
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
import type { ScraperResult } from "@/lib/scraper";

type QualityOption = {
  detail: string;
  id: string;
  index: number;
  label: string;
};

function getQualityOptionId(height: number | undefined, bitrate: number | null | undefined, index: number) {
  return `${height ?? "level"}-${bitrate ?? "auto"}-${index}`;
}

function AriseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2 4 7v10l8 5 8-5V7l-8-5Zm0 3.1 5 3v2.27l-5-2.85-5 2.85V8.1l5-3Zm-5 7.1 4 2.28V19l-4-2.5v-4.3Zm6 6.8v-4.52l4-2.28v4.3l-4 2.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2C6.48 2 2 6.58 2 12.22c0 4.5 2.87 8.31 6.84 9.66.5.1.68-.22.68-.48 0-.24-.01-1.03-.02-1.86-2.78.62-3.37-1.22-3.37-1.22-.45-1.18-1.1-1.49-1.1-1.49-.9-.63.07-.62.07-.62 1 .08 1.52 1.06 1.52 1.06.89 1.56 2.33 1.11 2.9.85.09-.66.35-1.11.63-1.36-2.22-.26-4.56-1.14-4.56-5.08 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.74 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.88c.85 0 1.7.12 2.5.35 1.9-1.33 2.74-1.05 2.74-1.05.55 1.43.2 2.48.1 2.74.64.72 1.03 1.63 1.03 2.75 0 3.95-2.34 4.82-4.57 5.07.36.32.68.95.68 1.92 0 1.38-.01 2.49-.01 2.83 0 .27.18.59.69.48A10.15 10.15 0 0 0 22 12.22C22 6.58 17.52 2 12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m12 2 1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Zm7 12 1 2.9L23 18l-3 1.1L19 22l-1.1-2.9L15 18l2.9-1.1L19 14ZM5 14l1.1 2.9L9 18l-2.9 1.1L5 22l-1.1-2.9L1 18l2.9-1.1L5 14Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 17 17 7M9 7h8v8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className={`copy-button${copied ? " is-copied" : ""}`}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      type="button"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function stripNullishValues(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;

  if (Array.isArray(value)) {
    return value
      .map((item) => stripNullishValues(item))
      .filter((item) => item !== undefined);
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, entryValue]) => [key, stripNullishValues(entryValue)] as const)
      .filter(([, entryValue]) => entryValue !== undefined);

    return Object.fromEntries(entries);
  }

  return value;
}

function renderJsonTokens(chunk: string, keyPrefix: string) {
  const tokenRegex =
    /"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?|\btrue\b|\bfalse\b|\bnull\b/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let matchIndex = 0;

  chunk.replace(tokenRegex, (match, offset) => {
    if (offset > lastIndex) {
      parts.push(
        <span key={`${keyPrefix}-plain-${matchIndex}`}>{chunk.slice(lastIndex, offset)}</span>,
      );
    }

    let className = "json-value";
    if (match.startsWith('"')) className = "json-string";
    else if (match === "true" || match === "false") className = "json-boolean";
    else if (match === "null") className = "json-null";
    else className = "json-number";

    parts.push(
      <span key={`${keyPrefix}-token-${matchIndex}`} className={className}>
        {match}
      </span>,
    );

    lastIndex = offset + match.length;
    matchIndex += 1;
    return match;
  });

  if (lastIndex < chunk.length) {
    parts.push(<span key={`${keyPrefix}-tail`}>{chunk.slice(lastIndex)}</span>);
  }

  return parts;
}

function renderJsonLine(line: string, index: number) {
  const keyMatch = line.match(/^(\s*)"([^"]+)":\s?(.*)$/);
  if (keyMatch) {
    return (
      <>
        <span>{keyMatch[1]}</span>
        <span className="json-key">"{keyMatch[2]}"</span>
        <span>: </span>
        {renderJsonTokens(keyMatch[3], `line-${index}`)}
      </>
    );
  }

  return <>{renderJsonTokens(line, `line-${index}`)}</>;
}

function JsonViewer({ value }: { value: unknown }) {
  const json = JSON.stringify(value, null, 2) ?? "{}";

  return (
    <pre className="json-viewer">
      {json.split("\n").map((line, index) => (
        <div key={`${index}-${line}`} className="json-viewer__line">
          {renderJsonLine(line, index)}
        </div>
      ))}
    </pre>
  );
}

export default function Home() {
  const [code, setCode] = useState("zbsewt");
  const [data, setData] = useState<ScraperResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [qualityOptions, setQualityOptions] = useState<QualityOption[]>([]);
  const [qualitySelection, setQualitySelection] = useState("auto");
  const inputRef = useRef<HTMLInputElement>(null);
  const playerRef = useRef<MediaPlayerInstance>(null);
  const currentCode = code.trim();

  async function handleLoad() {
    if (!currentCode) return;

    setLoading(true);
    setError("");
    setData(null);
    setQualityOptions([]);
    setQualitySelection("auto");

    try {
      const response = await fetch(`/api/${currentCode}`);
      const json = (await response.json()) as ScraperResult & { error?: string };

      if (!response.ok || json.error) {
        throw new Error(json.error ?? "Failed to fetch RPM response");
      }

      setData(json);
    } catch (loadError: any) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  function handleQualitySelect(selection: string) {
    const player = playerRef.current;
    if (!player) return;

    if (selection === "auto") {
      player.remoteControl.requestAutoQuality();
      setQualitySelection("auto");
      return;
    }

    const option = qualityOptions.find((item) => item.id === selection);
    if (!option) return;

    player.remoteControl.changeQuality(option.index);
    setQualitySelection(option.id);
  }

  useEffect(() => {
    if (code === "zbsewt") {
      void handleLoad();
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!data) return;

    setQualityOptions(
      data.qualities.map((quality, index) => ({
        detail: quality.bandwidth
          ? `${(quality.bandwidth / 1_000_000).toFixed(2)} Mbps`
          : "Adaptive stream",
        id: `fallback-${quality.resolution ?? "level"}-${index}`,
        index,
        label: quality.resolution ?? `Level ${index + 1}`,
      })),
    );
  }, [data]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const syncQualityState = () => {
      const nextOptions = player.qualities
        .toArray()
        .map((quality, index) => ({
          detail: quality.bitrate
            ? `${(quality.bitrate / 1_000_000).toFixed(2)} Mbps`
            : "Adaptive stream",
          id: getQualityOptionId(quality.height, quality.bitrate, index),
          index,
          label: quality.height ? `${quality.height}p` : `Level ${index + 1}`,
        }))
        .sort((left, right) => parseInt(right.label, 10) - parseInt(left.label, 10));

      if (nextOptions.length > 0) {
        setQualityOptions(nextOptions);
      }

      const selectedIndex = player.qualities.selected ? player.qualities.indexOf(player.qualities.selected) : -1;
      const selectedQuality = player.qualities.selected;
      setQualitySelection(
        player.qualities.auto || !selectedQuality || selectedIndex < 0
          ? "auto"
          : getQualityOptionId(selectedQuality.height, selectedQuality.bitrate, selectedIndex),
      );
    };

    syncQualityState();

    player.addEventListener("can-play", syncQualityState as EventListener);
    player.qualities.addEventListener("change", syncQualityState as EventListener);
    player.qualities.addEventListener("auto-change", syncQualityState as EventListener);

    return () => {
      player.removeEventListener("can-play", syncQualityState as EventListener);
      player.qualities.removeEventListener("change", syncQualityState as EventListener);
      player.qualities.removeEventListener("auto-change", syncQualityState as EventListener);
    };
  }, [data?.masterPlaylistProxy]);

  const playerSource = data?.masterPlaylistProxy
    ? ({ src: data.masterPlaylistProxy, type: "application/x-mpegurl" } as const)
    : null;
  const playerPoster = data?.posterProxy ?? data?.poster ?? undefined;
  const subtitleTracks = data?.subtitles.filter((track) => track.proxiedUrl) ?? [];
  const viewerPayload =
    (data ? stripNullishValues(data) : undefined) ?? {
      info: "Load a code to display the RPM scraper response.",
    };
  const viewerPayloadText = JSON.stringify(viewerPayload, null, 2);
  const logicSnippet = `<MediaPlayer src={{ src: data.masterPlaylistProxy, type: "application/x-mpegurl" }} poster={data.posterProxy}>
  <MediaProvider>
    {data.subtitles.map((track) => (
      <Track src={track.proxiedUrl} kind="subtitles" label={track.name} lang={track.language} />
    ))}
  </MediaProvider>
  <DefaultVideoLayout thumbnails={data.spritesheet.vttProxy} icons={defaultLayoutIcons} />
</MediaPlayer>`;

  return (
    <div className="rpm-shell">
      <div className="rpm-shell__glow rpm-shell__glow--one" />
      <div className="rpm-shell__glow rpm-shell__glow--two" />

      <header className="rpm-topbar">
        <div className="rpm-brand">
          <span className="rpm-brand__mark">RP</span>
          <div>
            <span className="rpm-brand__eyebrow">Arise RPM player lab</span>
            <strong className="rpm-brand__title">JSON + player viewer</strong>
          </div>
        </div>

        <div className="rpm-topbar__meta">
          <span className="inline-badge">AES-128-CBC</span>
          <a
            href="https://github.com/Arise-in/Rpm-scrapper"
            target="_blank"
            rel="noreferrer"
            className="text-link"
          >
            Project repo
          </a>
        </div>
      </header>

      <main className="rpm-main">
        <section className="rpm-intro">
          <div>
            <span className="section-kicker">Glass player workspace</span>
            <h1>Play the stream, switch quality outside the player, and inspect the JSON only.</h1>
          </div>
          <p>
            The page is simplified to the two things that matter here: the working player and the
            cleaned JSON response. Null keys are omitted from the viewer to keep the payload easier
            to scan.
          </p>
        </section>

        <section className="glass-card glass-card--hero rpm-query">
          <div className="rpm-query__meta">
            <div>
              <span className="section-kicker">Request</span>
              <strong className="section-title">`GET /api/[code]`</strong>
            </div>
            <span className="inline-badge">{loading ? "Fetching" : "Ready"}</span>
          </div>

          <div className="rpm-query__controls">
            <div className="rpm-input-wrap">
              <span className="rpm-input-wrap__prefix">/api/</span>
              <input
                ref={inputRef}
                className="rpm-input"
                placeholder="zbsewt"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleLoad();
                  }
                }}
              />
              <span className="rpm-keycap">Ctrl K</span>
            </div>

            <button
              className="primary-button"
              type="button"
              onClick={() => void handleLoad()}
              disabled={loading || !currentCode}
            >
              {loading ? "Loading..." : "Load"}
            </button>
          </div>
        </section>

        {error ? (
          <section className="glass-card glass-card--rose rpm-error">
            <span className="section-kicker">Request failed</span>
            <p>{error}</p>
          </section>
        ) : null}

        <section className="rpm-grid">
          <article className="glass-card glass-card--player player-card">
            <div className="card-head">
              <div>
                <span className="section-kicker">Player</span>
                <h2 className="section-title">External quality selector + storyboard hover previews</h2>
              </div>
              <span className="card-note">
                Vidstack still handles audio and captions inside the settings menu. The quality row
                below is a separate controller.
              </span>
            </div>

            <div className="player-stage">
              {playerSource ? (
                <MediaPlayer
                  ref={playerRef}
                  key={data?.masterPlaylistProxy}
                  title={data?.code}
                  src={playerSource}
                  poster={playerPoster}
                  crossOrigin="anonymous"
                  playsInline
                  streamType="on-demand"
                  className="rpm-player"
                >
                  <MediaProvider>
                    {subtitleTracks.map((track) => (
                      <Track
                        key={track.proxiedUrl}
                        src={track.proxiedUrl}
                        kind="subtitles"
                        label={track.name ?? track.language ?? "Subtitle"}
                        lang={track.language ?? "en"}
                        default={Boolean(track.default)}
                      />
                    ))}
                  </MediaProvider>
                  <DefaultVideoLayout
                    thumbnails={data?.spritesheet.vttProxy ?? undefined}
                    icons={defaultLayoutIcons}
                  />
                </MediaPlayer>
              ) : (
                <div className="player-empty">
                  <strong>{loading ? "Resolving stream..." : "Player will render here"}</strong>
                  <span>
                    {loading
                      ? "Decrypting RPM data, resolving the poster, captions, and storyboard VTT."
                      : "Load a code to attach the proxied master playlist to the player."}
                  </span>
                </div>
              )}
            </div>

            <div className="player-toolbar">
              <div className="player-toolbar__copy">
                <span className="section-kicker">Separate quality selector</span>
                <p>
                  `Auto` uses Vidstack&apos;s adaptive selection. Fixed buttons call the player
                  remote with the exact quality index after the quality list is loaded.
                </p>
              </div>

              <div className="quality-selector" role="group" aria-label="External quality selector">
                <button
                  type="button"
                  className={`quality-pill${qualitySelection === "auto" ? " is-active" : ""}`}
                  onClick={() => handleQualitySelect("auto")}
                  disabled={!playerSource}
                >
                  Auto
                </button>

                {qualityOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`quality-pill${qualitySelection === option.id ? " is-active" : ""}`}
                    onClick={() => handleQualitySelect(option.id)}
                    disabled={!playerSource}
                  >
                    <span>{option.label}</span>
                    <small>{option.detail}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="player-facts">
              <div className="fact-pill">
                <strong>{data?.audioTracks.length ?? 0}</strong>
                <span>audio tracks in settings</span>
              </div>
              <div className="fact-pill">
                <strong>{data?.subtitles.length ?? 0}</strong>
                <span>subtitle files mounted as `Track`</span>
              </div>
              <div className="fact-pill">
                <strong>{data?.spritesheet.vtt ? "VTT on" : "none"}</strong>
                <span>thumbnails prop powers hover previews</span>
              </div>
            </div>

            <div className="logic-card">
              <div className="logic-card__copy">
                <span className="section-kicker">Exact player logic</span>
                <h3>How this player is wired</h3>
                <ol className="logic-list">
                  <li>
                    The page calls <code>{`/api/${currentCode || "[code]"}`}</code> and receives the
                    decrypted RPM response.
                  </li>
                  <li>`masterPlaylistProxy` becomes the HLS player source so every playlist and segment stays proxied.</li>
                  <li>Each subtitle VTT is mounted with `&lt;Track /&gt;`, so captions appear in the default Vidstack menu.</li>
                  <li>`DefaultVideoLayout` receives `spritesheet.vttProxy`, which is why seek hover previews can use the storyboard VTT and image.</li>
                  <li>The external quality selector calls `player.remoteControl.changeQuality(index)` or `requestAutoQuality()` for adaptive mode.</li>
                </ol>
              </div>

              <pre className="logic-code">{logicSnippet}</pre>
            </div>
          </article>

          <article className="glass-card glass-card--teal json-card">
            <div className="card-head">
              <div>
                <span className="section-kicker">JSON output</span>
                <h2 className="section-title">Color-coded API response</h2>
              </div>

              <div className="json-card__actions">
                {data ? <span className="inline-badge">null keys hidden</span> : null}
                <CopyButton value={viewerPayloadText} />
              </div>
            </div>

            <JsonViewer value={viewerPayload} />
          </article>
        </section>
      </main>

      <footer className="rpm-footer">
        <div className="rpm-footer__brand">
          <span className="footer-icon">
            <AriseIcon />
          </span>
          <div>
            <strong>An Arise product</strong>
            <span>Built for RPM stream inspection, player debugging, and clean payload viewing.</span>
          </div>
        </div>

        <div className="rpm-footer__links">
          <a href="https://github.com/arise-in" target="_blank" rel="noreferrer">
            <GithubIcon />
            <span>arise-in</span>
            <ArrowUpRightIcon />
          </a>
          <a href="https://github.com/Arise-in/Rpm-scrapper" target="_blank" rel="noreferrer">
            <SparkIcon />
            <span>Rpm-scrapper</span>
            <ArrowUpRightIcon />
          </a>
        </div>
      </footer>
    </div>
  );
}
