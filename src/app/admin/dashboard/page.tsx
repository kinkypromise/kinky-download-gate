"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import EscaLogoGlitch from "@/components/EscaLogoGlitch";

interface Gate {
  id: string;
  title: string;
  scTrackUrn: string;
  scTrackUrl: string;
  fileName: string;
  fileSizeBytes: number;
  isActive: boolean;
  unlockCount: number;
  createdAt: string;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminDashboardPage() {
  const [gates, setGates] = useState<Gate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/gates")
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load gates");
        return r.json();
      })
      .then((data) => setGates(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load gates"))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const active = gates.filter((gate) => gate.isActive).length;
    const unlocks = gates.reduce((sum, gate) => sum + gate.unlockCount, 0);
    const storage = gates.reduce((sum, gate) => sum + gate.fileSizeBytes, 0);
    return { active, unlocks, storage };
  }, [gates]);

  async function toggleActive(id: string, current: boolean) {
    const res = await fetch(`/api/admin/gates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current }),
    });
    if (!res.ok) {
      setError("Could not update gate status.");
      return;
    }
    setGates((prev) => prev.map((g) => (g.id === id ? { ...g, isActive: !current } : g)));
  }

  async function deleteGate(id: string) {
    if (!confirm("Delete this gate permanently? The database record and linked file will be removed.")) return;
    const res = await fetch(`/api/admin/gates/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Could not delete gate.");
      return;
    }
    setGates((prev) => prev.filter((g) => g.id !== id));
  }

  async function copyLink(gateId: string) {
    const url = `${window.location.origin}/gate/${gateId}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(gateId);
    window.setTimeout(() => setCopiedId(null), 1600);
  }

  return (
    <main className="min-h-screen bg-[#050505] text-neutral-100 px-5 py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="grid gap-6 border-b border-neutral-900 pb-8 md:grid-cols-[360px_1fr_auto] md:items-end">
          <div className="-mx-4 h-40 md:mx-0">
            <EscaLogoGlitch className="h-full w-full" bpm={160} />
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.32em] text-neutral-500">backend / gates</p>
            <h1 className="font-display mt-2 text-6xl uppercase leading-none tracking-tight">Release Control</h1>
            <p className="mt-3 max-w-xl text-base text-neutral-500">
              Create SoundCloud unlock gates, track conversions, and keep downloadable assets attached to their records.
            </p>
          </div>
          <Link href="/admin/new" className="gate-btn border border-neutral-100 bg-neutral-100 px-5 py-4 text-center font-mono text-base font-bold uppercase tracking-[0.24em] text-[#050505]">
            New gate
          </Link>
          <Link href="/admin/settings" className="border border-neutral-800 px-5 py-4 text-center font-mono text-sm uppercase tracking-[0.2em] text-neutral-300 hover:border-neutral-600">
            Settings
          </Link>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <div className="border border-neutral-900 bg-neutral-950/60 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-neutral-600">active gates</p>
            <p className="mt-2 font-display text-5xl">{stats.active}</p>
          </div>
          <div className="border border-neutral-900 bg-neutral-950/60 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-neutral-600">total unlocks</p>
            <p className="mt-2 font-display text-5xl">{stats.unlocks}</p>
          </div>
          <div className="border border-neutral-900 bg-neutral-950/60 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-neutral-600">tracked storage</p>
            <p className="mt-2 font-display text-5xl">{formatBytes(stats.storage)}</p>
          </div>
        </section>

        {error && <p className="border border-red-900/60 bg-red-950/30 px-4 py-3 text-base text-red-300">{error}</p>}

        {loading ? (
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-neutral-600 gate-blink">loading gates</p>
        ) : gates.length === 0 ? (
          <section className="border border-dashed border-neutral-800 p-10 text-center">
            <p className="text-neutral-400">No gates yet.</p>
            <Link href="/admin/new" className="mt-5 inline-block border border-neutral-100 px-5 py-3 font-mono text-sm uppercase tracking-[0.24em] text-neutral-100">
              Create first gate
            </Link>
          </section>
        ) : (
          <section className="overflow-hidden border border-neutral-900">
            <div className="hidden grid-cols-[1.4fr_0.8fr_0.55fr_0.55fr_0.7fr] gap-4 border-b border-neutral-900 bg-neutral-950/80 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-600 md:grid">
              <span>release</span>
              <span>file</span>
              <span>unlocks</span>
              <span>status</span>
              <span>actions</span>
            </div>
            <div className="divide-y divide-neutral-900">
              {gates.map((gate) => (
                <article key={gate.id} className="grid gap-4 px-4 py-5 md:grid-cols-[1.4fr_0.8fr_0.55fr_0.55fr_0.7fr] md:items-center">
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-semibold text-neutral-100">{gate.title}</h2>
                    <p className="mt-1 break-all font-mono text-xs text-neutral-600">{gate.scTrackUrn}</p>
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-700">created {formatDate(gate.createdAt)}</p>
                  </div>
                  <div className="text-base text-neutral-400">
                    <p>{formatBytes(gate.fileSizeBytes)}</p>
                    <p className="mt-1 truncate font-mono text-xs text-neutral-700">{gate.fileName}</p>
                  </div>
                  <p className="font-display text-4xl">{gate.unlockCount}</p>
                  <button
                    onClick={() => toggleActive(gate.id, gate.isActive)}
                    className={`w-fit border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] ${
                      gate.isActive
                        ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-300"
                        : "border-neutral-800 bg-neutral-950 text-neutral-500"
                    }`}
                  >
                    {gate.isActive ? "active" : "inactive"}
                  </button>
                  <div className="flex flex-wrap gap-3 font-mono text-xs uppercase tracking-[0.18em]">
                    <button onClick={() => copyLink(gate.id)} className="text-neutral-300 underline decoration-neutral-700 underline-offset-4 hover:text-white">
                      {copiedId === gate.id ? "copied" : "copy"}
                    </button>
                    <a href={gate.scTrackUrl} target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-neutral-200">
                      soundcloud
                    </a>
                    <button onClick={() => deleteGate(gate.id)} className="text-red-400 hover:text-red-300">
                      delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
