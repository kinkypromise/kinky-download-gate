"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import EscaLogoGlitch from "@/components/EscaLogoGlitch";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setLoading(false);
    if (res.ok) {
      router.push("/admin/dashboard");
    } else {
      const data = await res.json().catch(() => ({ error: "Login failed" }));
      setError(data.error || "Invalid password");
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-neutral-100 flex items-center justify-center px-5 py-14">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.12),transparent_34%)]" />
      <section className="relative w-full max-w-sm border border-neutral-800 bg-neutral-950/70 p-6 shadow-[0_0_80px_-30px_rgba(255,255,255,0.35)] backdrop-blur">
        <div className="-mx-4 mb-6 h-36">
          <EscaLogoGlitch className="h-full w-full" bpm={160} />
        </div>
        <div className="mb-6 space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.32em] text-neutral-500">admin console</p>
          <h1 className="font-display text-5xl uppercase leading-none tracking-tight">ESCA Gate</h1>
          <p className="text-base text-neutral-500">Manage private SoundCloud unlocks and downloadable files.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-2">
            <span className="font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none transition-colors placeholder:text-neutral-700 focus:border-neutral-300"
              required
            />
          </label>
          {error && <p className="border border-red-900/60 bg-red-950/30 px-3 py-2 text-base text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="gate-btn w-full border border-neutral-100 bg-neutral-100 px-5 py-4 font-mono text-base font-bold uppercase tracking-[0.24em] text-[#050505] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Checking..." : "Login"}
          </button>
        </form>
      </section>
    </main>
  );
}
