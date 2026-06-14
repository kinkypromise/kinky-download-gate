"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import LogoGlitch from "@/components/LogoGlitch";

interface GateData {
  id: string;
  title: string;
  scTrackUrn: string;
  scTrackUrl: string;
}

interface OEmbedData {
  html: string;
  thumbnail_url?: string;
  title?: string;
}

interface PublicSettings {
  artistName: string;
  labelName: string;
  instagramUrl: string;
  spotifyUrl: string;
  accentColor: string;
  bpm: number;
  consentText: string;
  privacyText: string;
}

const NOISE_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

function SoundCloudIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="h-5 w-5 shrink-0 fill-current">
      <path d="M13.4 11.1c.5 0 .9.4.9.9v8.8c0 .5-.4.9-.9.9s-.9-.4-.9-.9V12c0-.5.4-.9.9-.9Zm-3.2 1.7c.5 0 .9.4.9.9v7.1c0 .5-.4.9-.9.9s-.9-.4-.9-.9v-7.1c0-.5.4-.9.9-.9Zm-3.1 2.4c.5 0 .9.4.9.9v4.7c0 .5-.4.9-.9.9s-.9-.4-.9-.9v-4.7c0-.5.4-.9.9-.9Zm-3.1 2.1c.5 0 .9.4.9.9v2.6c0 .5-.4.9-.9.9s-.9-.4-.9-.9v-2.6c0-.5.4-.9.9-.9Zm12.3-7.1c.7-.3 1.6-.5 2.5-.5 3.5 0 6.4 2.7 6.7 6.1.4-.1.8-.2 1.2-.2 2.3 0 4.1 1.8 4.1 4s-1.8 4-4.1 4H16.3V10.2Z" />
    </svg>
  );
}

function SpotifyIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="h-5 w-5 shrink-0 fill-current">
      <path d="M15.9 3.2c7.1 0 12.9 5.8 12.9 12.9S23 29 15.9 29 3 23.2 3 16.1 8.8 3.2 15.9 3.2Zm5.8 17.7c.6 1-.2 2.2-1.5 2.2-.6 0-1-.3-1.4-.9-1.1-1.8-3.4-2.5-5.8-2.5-1.1 0-2.2.1-3.3.4-.7.2-1.4-.3-1.6-1-.2-.7.2-1.4.9-1.6 1.4-.4 2.8-.5 4.2-.5 3.1 0 6 .9 7.7 2.9Zm1.9-4.1c.7 1.1-.2 2.5-1.6 2.5-.7 0-1.2-.3-1.7-1-1.6-2.5-4.8-3.5-8.1-3.5-1.4 0-2.8.2-4.1.6-.9.3-1.8-.3-2.1-1.2-.3-.9.2-1.9 1.1-2.2 1.7-.5 3.5-.8 5.3-.8 4.2 0 8.3 1.3 11.2 4.6Zm2-4.4c.9 1.4-.3 3.2-2.1 3.2-.9 0-1.5-.4-2.1-1.2-2.2-3.2-6.3-4.5-10.4-4.5-1.7 0-3.4.2-5 .7-1.1.3-2.2-.3-2.6-1.4-.3-1.1.3-2.2 1.4-2.5 2-.6 4.1-.9 6.2-.9 5.1 0 10.2 1.7 14.6 6Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="h-5 w-5 shrink-0 fill-current">
      <path d="M10.2 3.8h11.6c3.5 0 6.4 2.9 6.4 6.4v11.6c0 3.5-2.9 6.4-6.4 6.4H10.2c-3.5 0-6.4-2.9-6.4-6.4V10.2c0-3.5 2.9-6.4 6.4-6.4Zm0 2.5c-2.2 0-3.9 1.8-3.9 3.9v11.6c0 2.2 1.8 3.9 3.9 3.9h11.6c2.2 0 3.9-1.8 3.9-3.9V10.2c0-2.2-1.8-3.9-3.9-3.9H10.2Zm5.8 4.8a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8Zm0 2.5a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Zm6.8-3.9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
    </svg>
  );
}

function Countdown() {
  const [secondsLeft, setSecondsLeft] = useState(15 * 60);

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <span className="font-mono tabular-nums">
      {secondsLeft > 0 ? `${mm}:${ss}` : "expired — unlock again"}
    </span>
  );
}

function StepLabel({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 select-none">
      <span className="font-mono text-xs text-neutral-600">{n}</span>
      <span className="font-mono text-xs uppercase tracking-[0.25em] text-neutral-400">
        {children}
      </span>
      <span className="flex-1 border-t border-dashed border-neutral-800 translate-y-[-3px]" />
    </div>
  );
}

function interpolateArtistToken(text: string, artistName: string): string {
  return text.replace(/\{artist\}/g, artistName);
}

export default function GatePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const status = searchParams.get("status");
  const reason = searchParams.get("reason");
  const dlToken = searchParams.get("dl");

  const [gate, setGate] = useState<GateData | null>(null);
  const [oembed, setOembed] = useState<OEmbedData | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [commentLength, setCommentLength] = useState(0);

  const fetchOembed = useCallback(async (trackUrl: string) => {
    try {
      const res = await fetch(
        `https://soundcloud.com/oembed?url=${encodeURIComponent(trackUrl)}&format=json`
      );
      if (res.ok) {
        const data = await res.json();
        setOembed(data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetch("/api/settings/public")
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load settings");
        return r.json();
      })
      .then((data) => setSettings(data))
      .catch(() => {
        // Fail open with defaults so the gate still renders
        setSettings({
          artistName: "Artist",
          labelName: "",
          instagramUrl: "",
          spotifyUrl: "",
          accentColor: "#f22e8c",
          bpm: 160,
          consentText: "By unlocking, you will follow {artist} on SoundCloud, like and repost this track, and post your comment.",
          privacyText: "We only use your SoundCloud login to follow {artist} and like, repost, and comment on this track — nothing else. No email access. No newsletter. No stored fan profile.",
        });
      });
  }, []);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/gates/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Gate not found");
        return r.json();
      })
      .then((data) => {
        setGate(data);
        if (data.scTrackUrl) {
          fetchOembed(data.scTrackUrl);
        }
      })
      .catch(() => setError("This release does not exist or is no longer available."))
      .finally(() => setLoading(false));
  }, [fetchOembed, id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-neutral-100 flex items-center justify-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-neutral-600 gate-blink">
          loading
        </p>
        <style>{blinkCss}</style>
      </div>
    );
  }

  if (error || !gate) {
    return (
      <div className="min-h-screen bg-[#050505] text-neutral-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full border border-neutral-800 p-8 text-center space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-neutral-600">
            err / 404
          </p>
          <p className="text-neutral-300">{error || "This release does not exist."}</p>
        </div>
      </div>
    );
  }

  const cover = oembed?.thumbnail_url;
  const artistName = settings?.artistName || "Artist";
  const accentColor = settings?.accentColor || "#f22e8c";
  const bpm = settings?.bpm ?? 160;
  const consentText = interpolateArtistToken(settings?.consentText || "", artistName);
  const privacyText = interpolateArtistToken(settings?.privacyText || "", artistName);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] text-neutral-100 flex flex-col items-center justify-center px-5 py-14">
      {/* Ambient backdrop: the cover art itself, oversized + blurred */}
      {cover && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt=""
            className="absolute left-1/2 top-1/2 w-[140vmax] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-25 blur-[110px] saturate-150"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/70 via-transparent to-[#050505]" />
        </div>
      )}

      {/* Film grain */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.05] mix-blend-screen"
        style={{ backgroundImage: NOISE_BG }}
      />

      <main className="relative w-full max-w-md gate-enter">
        <header className="space-y-4">
          <div className="-mx-5 h-36 sm:-mx-8 sm:h-44">
            <LogoGlitch className="h-full w-full" bpm={bpm} accentColor={accentColor} />
          </div>
          <div className="flex items-center justify-between font-mono text-xs uppercase tracking-[0.3em] text-neutral-500">
            <span>{artistName.toLowerCase()}</span>
            <span className="flex-1 mx-4 border-t border-dashed border-neutral-800" />
            <span>free download</span>
          </div>
        </header>

        {/* Cover */}
        <div className="mt-6 border border-neutral-800 bg-neutral-900/40 p-2 shadow-[0_0_80px_-20px_rgba(255,255,255,0.15)]">
          {cover ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={cover} alt={gate.title} className="block w-full" />
          ) : (
            <div className="aspect-square w-full bg-neutral-900" />
          )}
        </div>

        {/* Title */}
        <h1 className="font-display mt-7 text-[clamp(2.6rem,11vw,3.6rem)] leading-[0.92] uppercase tracking-tight">
          {gate.title}
        </h1>

        {status === "unlocked" && dlToken ? (
          /* ───────────────── UNLOCKED ───────────────── */
          <div className="mt-10 space-y-8">
            <StepLabel n="03">download ready</StepLabel>

            <a
              href={`/api/download?token=${encodeURIComponent(dlToken)}`}
              className="gate-btn block w-full border border-neutral-100 bg-neutral-100 px-6 py-5 text-center font-mono text-base font-bold uppercase tracking-[0.25em] text-[#050505]"
            >
              Download track
            </a>

            <p className="text-center font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">
              link expires in <Countdown />
            </p>

            {(settings?.instagramUrl || settings?.spotifyUrl) && (
              <div className="border-t border-dashed border-neutral-800 pt-6 text-center">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-600">
                  optional follows
                </p>
                <div className="mt-3 grid gap-3">
                  {settings?.instagramUrl && (
                    <a
                      href={settings.instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="social-btn flex items-center justify-center gap-3 border border-neutral-200 bg-neutral-100 px-5 py-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#050505]"
                    >
                      <InstagramIcon />
                      Instagram
                    </a>
                  )}
                  {settings?.spotifyUrl && (
                    <a
                      href={settings.spotifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="social-btn flex items-center justify-center gap-3 border border-neutral-200 bg-neutral-100 px-5 py-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#050505]"
                    >
                      <SpotifyIcon />
                      Spotify
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : status === "error" ? (
          /* ───────────────── ERROR ───────────────── */
          <div className="mt-10 space-y-6">
            <div className="border border-neutral-700 p-5">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-neutral-500">
                err /{" "}
                {reason === "invalid_comment"
                  ? "comment"
                  : reason === "oauth_denied"
                    ? "denied"
                    : "soundcloud"}
              </p>
              <p className="mt-2 text-base text-neutral-300">
                {reason === "invalid_comment"
                  ? "Your comment needs to be between 1 and 280 characters."
                  : reason === "oauth_denied"
                    ? "You cancelled the SoundCloud connection. Unlock needs your OK."
                    : "Something went wrong talking to SoundCloud. Try again."}
              </p>
            </div>
            <a
              href={`/gate/${gate.id}`}
              className="gate-btn block w-full border border-neutral-100 bg-neutral-100 px-6 py-4 text-center font-mono text-base font-bold uppercase tracking-[0.25em] text-[#050505]"
            >
              Try again
            </a>
          </div>
        ) : (
          /* ───────────────── LOCKED / FORM ───────────────── */
          <div className="mt-10">
            <form method="POST" action="/api/auth/start" className="space-y-8">
              <input type="hidden" name="gateId" value={gate.id} />

              <div className="space-y-3">
                <StepLabel n="01">leave a comment</StepLabel>
                <textarea
                  id="comment"
                  name="comment"
                  rows={3}
                  maxLength={280}
                  required
                  placeholder="What do you think about this track?"
                  onChange={(e) => setCommentLength(e.target.value.length)}
                  className="w-full resize-none border border-neutral-800 bg-neutral-950/60 px-4 py-3 text-[15px] text-neutral-100 placeholder-neutral-600 outline-none transition-colors focus:border-neutral-400"
                />
                <p className="text-right font-mono text-xs tabular-nums text-neutral-600">
                  {commentLength} / 280
                </p>
              </div>

              <div className="space-y-3">
                <StepLabel n="02">unlock via soundcloud</StepLabel>
                <button
                  type="submit"
                  className="gate-btn flex w-full items-center justify-center gap-3 border border-neutral-100 bg-neutral-100 px-6 py-5 text-center font-mono text-base font-bold uppercase tracking-[0.25em] text-[#050505]"
                >
                  <SoundCloudIcon />
                  Unlock download
                </button>
              </div>
            </form>

            <div className="mt-8 space-y-3 border-t border-dashed border-neutral-800 pt-6">
              {consentText && (
                <p className="text-center font-mono text-[11px] uppercase tracking-[0.15em] leading-relaxed text-neutral-500">
                  {consentText}
                </p>
              )}
              {privacyText && (
                <p className="text-center text-xs leading-relaxed text-neutral-600">
                  {privacyText}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.3em] text-neutral-700">
          <span>{settings?.labelName || ""}</span>
          <span>{new Date().getFullYear()}</span>
        </div>
      </main>

      <style>{pageCss}</style>
      <style>{blinkCss}</style>
    </div>
  );
}

const pageCss = `
@media (prefers-reduced-motion: no-preference) {
  .gate-enter {
    animation: gate-rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes gate-rise {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
  }
}
.gate-btn {
  box-shadow: 0 0 0 1px rgba(255,255,255,0.12), 0 18px 55px -24px rgba(255,255,255,0.75);
  transition: transform 0.15s ease, background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}
.gate-btn:hover {
  transform: translateY(-1px);
  background-color: #050505;
  color: #f5f5f5;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.55), 0 0 48px -10px rgba(255, 255, 255, 0.55);
}
.social-btn {
  box-shadow: 0 14px 46px -26px rgba(255,255,255,0.7);
  transition: transform 0.15s ease, background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}
.social-btn:hover {
  transform: translateY(-1px);
  border-color: #f5f5f5;
  background-color: #050505;
  color: #f5f5f5;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.45), 0 0 42px -14px rgba(255,255,255,0.55);
}
.gate-btn:focus-visible,
.social-btn:focus-visible {
  outline: 2px solid #f5f5f5;
  outline-offset: 3px;
}
`;

const blinkCss = `
@media (prefers-reduced-motion: no-preference) {
  .gate-blink { animation: gate-blink 1.1s steps(2, start) infinite; }
  @keyframes gate-blink { to { visibility: hidden; } }
}
`;
