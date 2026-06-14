"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    password: "",
    confirmPassword: "",
    artistName: "",
    labelName: "",
    instagramUrl: "",
    spotifyUrl: "",
    accentColor: "#f22e8c",
    bpm: 160,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField(field: keyof typeof form, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.password.length < 10) {
      setError("Admin password must be at least 10 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(form.accentColor)) {
      setError("Accent color must be a 6-digit hex code like #f22e8c.");
      return;
    }
    if (form.bpm < 60 || form.bpm > 220) {
      setError("BPM must be between 60 and 220.");
      return;
    }
    if (form.instagramUrl && !form.instagramUrl.startsWith("https://")) {
      setError("Instagram URL must start with https://.");
      return;
    }
    if (form.spotifyUrl && !form.spotifyUrl.startsWith("https://")) {
      setError("Spotify URL must start with https://.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: form.password,
        artistName: form.artistName || "Your Artist Name",
        labelName: form.labelName,
        instagramUrl: form.instagramUrl,
        spotifyUrl: form.spotifyUrl,
        accentColor: form.accentColor,
        bpm: form.bpm,
      }),
    });
    setLoading(false);

    if (res.ok) {
      router.push("/admin");
    } else {
      const data = await res.json().catch(() => ({ error: "Setup failed" }));
      setError(data.error || "Setup failed");
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-neutral-100 flex items-center justify-center px-5 py-14">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.12),transparent_34%)]" />
      <section className="relative w-full max-w-lg border border-neutral-800 bg-neutral-950/70 p-6 shadow-[0_0_80px_-30px_rgba(255,255,255,0.35)] backdrop-blur">
        <div className="mb-6 space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.32em] text-neutral-500">first-run setup</p>
          <h1 className="font-display text-4xl uppercase leading-none tracking-tight">Configure Gate</h1>
          <p className="text-base text-neutral-500">Set your admin password and brand this gate before fans arrive.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset className="space-y-4 border border-neutral-800 p-4">
            <legend className="px-2 font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">Admin password</legend>
            <label className="block space-y-2">
              <span className="font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">password</span>
              <input
                type="password"
                value={form.password}
                onChange={(e) => updateField("password", e.target.value)}
                placeholder="At least 10 characters"
                minLength={10}
                className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none transition-colors placeholder:text-neutral-700 focus:border-neutral-300"
                required
              />
            </label>
            <label className="block space-y-2">
              <span className="font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">confirm password</span>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => updateField("confirmPassword", e.target.value)}
                placeholder="Repeat the password"
                className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none transition-colors placeholder:text-neutral-700 focus:border-neutral-300"
                required
              />
            </label>
          </fieldset>

          <fieldset className="space-y-4 border border-neutral-800 p-4">
            <legend className="px-2 font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">Branding</legend>
            <label className="block space-y-2">
              <span className="font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">artist name *</span>
              <input
                type="text"
                value={form.artistName}
                onChange={(e) => updateField("artistName", e.target.value)}
                placeholder="Your Artist Name"
                className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none transition-colors placeholder:text-neutral-700 focus:border-neutral-300"
                required
              />
            </label>
            <label className="block space-y-2">
              <span className="font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">label name</span>
              <input
                type="text"
                value={form.labelName}
                onChange={(e) => updateField("labelName", e.target.value)}
                placeholder="Optional"
                className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none transition-colors placeholder:text-neutral-700 focus:border-neutral-300"
              />
            </label>
            <label className="block space-y-2">
              <span className="font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">instagram url</span>
              <input
                type="url"
                value={form.instagramUrl}
                onChange={(e) => updateField("instagramUrl", e.target.value)}
                placeholder="https://instagram.com/your-artist-handle"
                className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none transition-colors placeholder:text-neutral-700 focus:border-neutral-300"
              />
            </label>
            <label className="block space-y-2">
              <span className="font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">spotify url</span>
              <input
                type="url"
                value={form.spotifyUrl}
                onChange={(e) => updateField("spotifyUrl", e.target.value)}
                placeholder="https://open.spotify.com/artist/ABC123"
                className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none transition-colors placeholder:text-neutral-700 focus:border-neutral-300"
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block space-y-2">
                <span className="font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">accent color</span>
                <input
                  type="color"
                  value={form.accentColor}
                  onChange={(e) => updateField("accentColor", e.target.value)}
                  className="h-12 w-full border border-neutral-800 bg-neutral-950 px-2 py-1"
                />
              </label>
              <label className="block space-y-2">
                <span className="font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">bpm</span>
                <input
                  type="number"
                  min={60}
                  max={220}
                  value={form.bpm}
                  onChange={(e) => updateField("bpm", Number(e.target.value))}
                  className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none transition-colors placeholder:text-neutral-700 focus:border-neutral-300"
                  required
                />
              </label>
            </div>
          </fieldset>

          <p className="text-sm text-neutral-500">
            SoundCloud credentials (Client ID, Secret, artist URN) are configured in <code className="text-neutral-300">.env</code>. See the README for how to register your SoundCloud app and resolve your artist URN.
          </p>

          {error && <p className="border border-red-900/60 bg-red-950/30 px-3 py-2 text-base text-red-300">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="gate-btn w-full border border-neutral-100 bg-neutral-100 px-5 py-4 font-mono text-base font-bold uppercase tracking-[0.24em] text-[#050505] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Setting up..." : "Finish Setup"}
          </button>
        </form>
      </section>
    </main>
  );
}
