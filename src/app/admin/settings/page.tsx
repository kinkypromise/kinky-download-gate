"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SettingsForm {
  artistName: string;
  labelName: string;
  instagramUrl: string;
  accentColor: string;
  bpm: number;
  consentText: string;
  privacyText: string;
  newPassword: string;
  confirmNewPassword: string;
}

export default function AdminSettingsPage() {
  const [form, setForm] = useState<SettingsForm>({
    artistName: "",
    labelName: "",
    instagramUrl: "",
    accentColor: "#f22e8c",
    bpm: 160,
    consentText: "",
    privacyText: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load settings");
        return r.json();
      })
      .then((data: Partial<SettingsForm>) => {
        setForm((prev) => ({ ...prev, ...data }));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  function updateField(field: keyof SettingsForm, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!/^#[0-9a-fA-F]{6}$/.test(form.accentColor)) {
      setError("Accent color must be a 6-digit hex code.");
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
    if (form.newPassword) {
      if (form.newPassword.length < 10) {
        setError("New password must be at least 10 characters.");
        return;
      }
      if (form.newPassword !== form.confirmNewPassword) {
        setError("New passwords do not match.");
        return;
      }
    }

    const body: Record<string, unknown> = {
      artistName: form.artistName,
      labelName: form.labelName,
      instagramUrl: form.instagramUrl,
      accentColor: form.accentColor,
      bpm: form.bpm,
      consentText: form.consentText,
      privacyText: form.privacyText,
    };
    if (form.newPassword) {
      body.newPassword = form.newPassword;
    }

    setSaving(true);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);

    if (res.ok) {
      setSuccess("Settings saved.");
      setForm((prev) => ({ ...prev, newPassword: "", confirmNewPassword: "" }));
    } else {
      const data = await res.json().catch(() => ({ error: "Save failed" }));
      setError(data.error || "Save failed");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050505] px-5 py-8 text-neutral-100">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-neutral-600 gate-blink">loading settings</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] px-5 py-8 text-neutral-100">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="border-b border-neutral-900 pb-6">
          <p className="font-mono text-xs uppercase tracking-[0.32em] text-neutral-500">backend / settings</p>
          <h1 className="font-display mt-2 text-6xl uppercase leading-none tracking-tight">Settings</h1>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <fieldset className="space-y-4 border border-neutral-800 p-5">
            <legend className="px-2 font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">Branding</legend>

            <label className="block space-y-2">
              <span className="font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">artist name *</span>
              <input
                type="text"
                value={form.artistName}
                onChange={(e) => updateField("artistName", e.target.value)}
                className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none transition-colors focus:border-neutral-300"
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">label name</span>
              <input
                type="text"
                value={form.labelName}
                onChange={(e) => updateField("labelName", e.target.value)}
                className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none transition-colors focus:border-neutral-300"
              />
            </label>

            <label className="block space-y-2">
              <span className="font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">instagram url</span>
              <input
                type="url"
                value={form.instagramUrl}
                onChange={(e) => updateField("instagramUrl", e.target.value)}
                placeholder="https://instagram.com/yourhandle"
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
                  className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none transition-colors focus:border-neutral-300"
                  required
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="space-y-4 border border-neutral-800 p-5">
            <legend className="px-2 font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">Copy</legend>

            <label className="block space-y-2">
              <span className="font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">consent text</span>
              <textarea
                value={form.consentText}
                onChange={(e) => updateField("consentText", e.target.value)}
                rows={3}
                className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none transition-colors focus:border-neutral-300"
              />
            </label>

            <label className="block space-y-2">
              <span className="font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">privacy text</span>
              <textarea
                value={form.privacyText}
                onChange={(e) => updateField("privacyText", e.target.value)}
                rows={3}
                className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none transition-colors focus:border-neutral-300"
              />
            </label>

            <p className="text-sm text-neutral-500">Use {"{artist}"} as a placeholder for the artist name.</p>
          </fieldset>

          <fieldset className="space-y-4 border border-neutral-800 p-5">
            <legend className="px-2 font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">Change admin password</legend>

            <label className="block space-y-2">
              <span className="font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">new password</span>
              <input
                type="password"
                value={form.newPassword}
                onChange={(e) => updateField("newPassword", e.target.value)}
                placeholder="Leave blank to keep current password"
                className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none transition-colors placeholder:text-neutral-700 focus:border-neutral-300"
              />
            </label>

            <label className="block space-y-2">
              <span className="font-mono text-xs uppercase tracking-[0.24em] text-neutral-500">confirm new password</span>
              <input
                type="password"
                value={form.confirmNewPassword}
                onChange={(e) => updateField("confirmNewPassword", e.target.value)}
                placeholder="Repeat new password"
                className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none transition-colors placeholder:text-neutral-700 focus:border-neutral-300"
              />
            </label>
          </fieldset>

          {error && <p className="border border-red-900/60 bg-red-950/30 px-3 py-2 text-base text-red-300">{error}</p>}
          {success && <p className="border border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-base text-emerald-300">{success}</p>}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="gate-btn border border-neutral-100 bg-neutral-100 px-6 py-4 font-mono text-base font-bold uppercase tracking-[0.24em] text-[#050505] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save settings"}
            </button>
            <Link href="/admin/dashboard" className="font-mono text-sm uppercase tracking-[0.2em] text-neutral-500 hover:text-neutral-300">
              back to dashboard
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
