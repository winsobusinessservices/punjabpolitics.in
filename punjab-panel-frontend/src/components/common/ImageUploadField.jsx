"use client";
import { useRef, useState } from "react";
import { mediaUrl, uploadApi } from "@/lib/api";

const inputClass = "w-full rounded-lg border border-outline-variant/30 bg-surface px-3 py-2.5 text-sm focus:border-primary focus:outline-none";

// Upload-an-image control that replaces a free-text "image URL" input. The
// form value stays a plain path string (e.g. /uploads/media/…), so saved data
// and existing URLs keep working unchanged.
export default function ImageUploadField({ label, value, onChange, required = false, className = "" }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const { url } = await uploadApi.image(file);
      onChange(url);
    } catch (e) {
      setError(e.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`text-xs font-label-md text-on-surface-variant ${className}`}>
      {label}{required && <span className="text-error"> *</span>}
      <div className="mt-1.5 flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(value)} alt="" className="h-14 w-14 flex-shrink-0 rounded border border-outline-variant/30 bg-surface-container object-cover" />
        ) : (
          <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded border border-dashed border-outline-variant/50 text-[10px]">No image</span>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="rounded-lg border border-primary/40 px-3 py-2 text-xs text-primary disabled:opacity-60">
            {busy ? "Uploading…" : value ? "Replace image" : "Upload image"}
          </button>
          {value && !busy && <button type="button" onClick={() => onChange("")} className="text-xs text-error">Remove</button>}
        </div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={pick} className="hidden" />
      </div>
      {error && <p className="mt-1 text-error">{error}</p>}
    </div>
  );
}
