"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LogoGlitch from "@/components/LogoGlitch";

interface PublicSettings {
  artistName: string;
  accentColor: string;
  bpm: number;
}

const MAX_UPLOAD_BYTES = 600 * 1024 * 1024;
const CHUNK_SIZE = 8 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

export default function NewGatePage() {
  const [title, setTitle] = useState("");
  const [scTrackUrl, setScTrackUrl] = useState("");
  const [scTrackUrn, setScTrackUrn] = useState("");
  const [resolving, setResolving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<PublicSettings>({
    artistName: "Artist",
    accentColor: "#f22e8c",
    bpm: 160,
  });
  const router = useRouter();

  useEffect(() => {
    fetch("/api/settings/public")
      .then(async (r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: PublicSettings) => setSettings(data))
      .catch(() => {
        // defaults already set
      });
  }, []);

  async function resolveUrnFromUrl(url: string) {
    if (!url.includes("soundcloud.com")) return;
    setResolving(true);
    try {
      const oembedRes = await fetch(`https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (oembedRes.ok) {
        const data = await oembedRes.json();
        const html = data.html ?? "";
        const idMatch = html.match(/tracks%2F(\d+)/);
        if (idMatch) setScTrackUrn(`soundcloud:tracks:${idMatch[1]}`);
      }
    } catch {
      // Admin can enter the URN manually.
    } finally {
      setResolving(false);
    }
  }

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setUploadProgress(0);
    setError("");
    if (!nextFile) return;
    const name = nextFile.name.toLowerCase();
    if (!name.endsWith(".wav") && !name.endsWith(".mp3")) {
      setError("Select a WAV or MP3 file.");
      return;
    }
    if (nextFile.size > MAX_UPLOAD_BYTES) {
      setError(`File is too large (${formatBytes(nextFile.size)}). Maximum upload size is ${formatBytes(MAX_UPLOAD_BYTES)}.`);
    }
  }

  function postFormData(formData: FormData, onProgress?: (loaded: number, total: number) => void) {
    return new Promise<{ status: number; data: { error?: string; id?: string } }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/admin/gates/upload");
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(event.loaded, event.total);
        }
      };
      xhr.onload = () => {
        let data: { error?: string; id?: string } = {};
        try {
          data = JSON.parse(xhr.responseText || "{}");
        } catch {
          data = { error: xhr.responseText?.slice(0, 240) || "Upload failed" };
        }
        resolve({ status: xhr.status, data });
      };
      xhr.onerror = () => reject(new Error("Network error during upload. Check the connection and try again."));
      xhr.onabort = () => reject(new Error("Upload cancelled."));
      xhr.send(formData);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Select an audio file before creating the gate.");
      return;
    }
    if (!scTrackUrn.startsWith("soundcloud:tracks:")) {
      setError("SoundCloud Track URN must start with soundcloud:tracks:.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`File is too large. Maximum upload size is ${formatBytes(MAX_UPLOAD_BYTES)}.`);
      return;
    }

    setLoading(true);
    setError("");
    setUploadProgress(0);
    setStatusMessage("Preparing chunked upload...");

    try {
      const uploadId = crypto.randomUUID();
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      let uploadedBytes = 0;

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        const chunkForm = new FormData();
        chunkForm.append("action", "chunk");
        chunkForm.append("uploadId", uploadId);
        chunkForm.append("chunkIndex", String(chunkIndex));
        chunkForm.append("totalChunks", String(totalChunks));
        chunkForm.append("fileName", file.name);
        chunkForm.append("file", chunk, file.name);

        const result = await postFormData(chunkForm, (loaded) => {
          const currentLoaded = uploadedBytes + loaded;
          const percent = Math.max(1, Math.min(99, Math.round((currentLoaded / file.size) * 100)));
          setUploadProgress(percent);
          setStatusMessage(`Uploading chunk ${chunkIndex + 1} of ${totalChunks}: ${formatBytes(currentLoaded)} of ${formatBytes(file.size)} (${percent}%)`);
        });

        if (result.status < 200 || result.status >= 300) {
          throw new Error(result.data.error || `Upload failed with HTTP ${result.status}.`);
        }

        uploadedBytes = end;
      }

      setUploadProgress(99);
      setStatusMessage("Finalizing gate record...");

      const finalizeForm = new FormData();
      finalizeForm.append("action", "finalize");
      finalizeForm.append("uploadId", uploadId);
      finalizeForm.append("title", title.trim());
      finalizeForm.append("scTrackUrl", scTrackUrl.trim());
      finalizeForm.append("scTrackUrn", scTrackUrn.trim());
      finalizeForm.append("fileName", file.name);
      finalizeForm.append("fileSize", String(file.size));

      const finalize = await postFormData(finalizeForm);
      if (finalize.status < 200 || finalize.status >= 300) {
        throw new Error(finalize.data.error || `Finalizing failed with HTTP ${finalize.status}.`);
      }

      setUploadProgress(100);
      setStatusMessage("Upload complete. Opening dashboard...");
      router.push("/admin/dashboard");
    } catch (err) {
      setLoading(false);
      setStatusMessage("");
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] text-neutral-100 px-5 py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="border-b border-neutral-900 pb-8">
          <div className="-mx-4 h-40 max-w-xl">
            <LogoGlitch className="h-full w-full" bpm={settings.bpm} accentColor={settings.accentColor} />
          </div>
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.32em] text-neutral-500">backend / new gate</p>
          <h1 className="font-display mt-2 text-6xl uppercase leading-none tracking-tight">{settings.artistName} Gate</h1>
          <p className="mt-3 max-w-xl text-base text-neutral-500">
            Upload a WAV or MP3 in nginx-safe chunks, attach the SoundCloud track, and publish a private unlock page.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6 border border-neutral-900 bg-neutral-950/50 p-5 md:p-6">
          <label className="block space-y-2">
            <span className="font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">release title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none transition-colors placeholder:text-neutral-700 focus:border-neutral-300"
              placeholder="BREAK A BRICK"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">SoundCloud track URL</span>
            <input
              value={scTrackUrl}
              onChange={(e) => {
                setScTrackUrl(e.target.value);
                void resolveUrnFromUrl(e.target.value);
              }}
              placeholder="https://soundcloud.com/artist/track"
              className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none transition-colors placeholder:text-neutral-700 focus:border-neutral-300"
              required
            />
            <p className="text-sm text-neutral-600">The backend will use this URL for the public cover/embed preview.</p>
          </label>

          <label className="block space-y-2">
            <span className="font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">
              SoundCloud track URN {resolving && <span className="text-neutral-400">/ resolving</span>}
            </span>
            <input
              value={scTrackUrn}
              onChange={(e) => setScTrackUrn(e.target.value)}
              placeholder="soundcloud:tracks:123456789"
              className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 font-mono text-base text-neutral-100 outline-none transition-colors placeholder:text-neutral-700 focus:border-neutral-300"
              required
            />
            <p className="text-sm text-neutral-600">Must be a track URN, not an artist/user URN.</p>
          </label>

          <label className="block space-y-3">
            <span className="font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">audio file</span>
            <input
              type="file"
              accept="audio/wav,audio/x-wav,audio/mpeg,.wav,.mp3"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              className="w-full border border-dashed border-neutral-700 bg-neutral-950 px-4 py-5 text-base text-neutral-400 file:mr-4 file:border-0 file:bg-neutral-100 file:px-4 file:py-2 file:font-mono file:text-sm file:font-bold file:uppercase file:tracking-[0.18em] file:text-[#050505]"
              required
            />
            {file && (
              <div className="grid gap-2 border border-neutral-900 bg-black/30 p-3 text-base text-neutral-400 md:grid-cols-3">
                <p className="truncate"><span className="text-neutral-600">Name:</span> {file.name}</p>
                <p><span className="text-neutral-600">Size:</span> {formatBytes(file.size)}</p>
                <p><span className="text-neutral-600">Type:</span> {file.type || "unknown"}</p>
              </div>
            )}
          </label>

          {(loading || statusMessage) && (
            <div className="space-y-2">
              <div className="h-2 overflow-hidden bg-neutral-900">
                <div className="h-full bg-neutral-100 transition-[width] duration-200" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-neutral-500">{statusMessage || "Uploading..."}</p>
            </div>
          )}

          {error && <p className="border border-red-900/60 bg-red-950/30 px-4 py-3 text-base text-red-300">{error}</p>}

          <div className="flex flex-col gap-3 border-t border-neutral-900 pt-6 md:flex-row">
            <button
              type="submit"
              disabled={loading || resolving}
              className="gate-btn flex-1 border border-neutral-100 bg-neutral-100 px-5 py-4 font-mono text-base font-bold uppercase tracking-[0.24em] text-[#050505] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Uploading" : "Create gate"}
            </button>
            <Link href="/admin/dashboard" className="border border-neutral-800 px-5 py-4 text-center font-mono text-base uppercase tracking-[0.24em] text-neutral-400 hover:border-neutral-500 hover:text-neutral-100">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
