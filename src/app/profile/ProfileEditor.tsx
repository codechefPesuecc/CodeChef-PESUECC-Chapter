"use client";

import { useState } from "react";
import MechaPanel from "@/components/cp-arena/MechaPanel";

/** Crop-to-square + downscale to `size`px and compress to WebP, all client-side,
 *  so the Worker only ever receives a small (~20–40 KB) image. */
async function resizeToWebp(file: File, size = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  bitmap.close?.();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not process image"))),
      "image/webp",
      0.85,
    ),
  );
}

export default function ProfileEditor({
  initialName,
  initialUsername,
  initialAvatar,
}: {
  initialName: string;
  initialUsername: string;
  initialAvatar: string | null;
}) {
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErr("Please pick an image file.");
      return;
    }
    setErr(null);
    setMsg(null);
    setUploading(true);
    try {
      const blob = await resizeToWebp(file);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "image/webp" },
        body: blob,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.error ?? "Upload failed.");
        return;
      }
      setAvatar(data.avatar);
      setMsg("Photo updated.");
      // Reload so the navbar (and anywhere else) picks up the new avatar.
      setTimeout(() => window.location.reload(), 700);
    } catch {
      setErr("Couldn't process that image.");
    } finally {
      setUploading(false);
    }
  };

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.error ?? "Couldn't save changes.");
        setSaving(false);
        return;
      }
      setMsg("Saved.");
    } catch {
      setErr("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  };

  const avatarUrl = avatar ? `/api/avatars/${encodeURIComponent(avatar)}` : null;
  const initial = (name || username || "?").charAt(0).toUpperCase();

  return (
    <MechaPanel className="mt-6" label="Edit profile">
      <div className="px-5 pb-5 pt-4">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-bronze/15 font-display text-2xl font-bold text-bronze">
              {initial}
            </span>
          )}
          <div>
            <label className="mecha-btn mecha-btn--ghost mecha-btn--sm cursor-pointer">
              {uploading ? "Uploading…" : "Change photo"}
              <input
                type="file"
                accept="image/*"
                onChange={onPickFile}
                disabled={uploading}
                className="hidden"
              />
            </label>
            <p className="mt-1 text-xs text-charcoal/50">
              PNG, JPEG, or WebP. Cropped to a square automatically.
            </p>
          </div>
        </div>

        <form onSubmit={saveDetails} className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-charcoal/70">
              Name
            </label>
            <input
              className="mecha-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              autoComplete="name"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-charcoal/70">
              Username{" "}
              <span className="font-normal text-charcoal/45">· public handle</span>
            </label>
            <input
              className="mecha-input"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
              }
              minLength={3}
              maxLength={20}
              autoComplete="username"
              required
            />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="mecha-btn mecha-btn--solid"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            {msg && (
              <span className="text-sm text-emerald-600 dark:text-emerald-400">
                {msg}
              </span>
            )}
            {err && (
              <span className="text-sm text-red-600 dark:text-red-400">{err}</span>
            )}
          </div>
        </form>
      </div>
    </MechaPanel>
  );
}
