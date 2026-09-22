"use client";

import type { StripCaption } from "@/types";

const FONT_OPTIONS = [
  { label: "Handwritten", value: "Caveat" },
  { label: "Marker", value: "Permanent Marker" },
  { label: "Typewriter", value: "Special Elite" },
  { label: "Clean", value: "Poppins" },
];

interface CaptionEditorProps {
  caption: StripCaption;
  onChange: (caption: StripCaption) => void;
}

export function CaptionEditor({ caption, onChange }: CaptionEditorProps) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3">
      <span className="text-xs uppercase tracking-[0.2em] text-muted">Caption</span>

      <input
        value={caption.text}
        onChange={(e) => onChange({ ...caption, text: e.target.value })}
        placeholder="Add a caption…"
        maxLength={60}
        className="w-full rounded-xl border border-surface/15 bg-surface/5 px-4 py-2 text-sm text-paper outline-none focus:border-flash focus:ring-2 focus:ring-flash/40"
      />

      <div className="flex items-center gap-3">
        <select
          value={caption.font}
          onChange={(e) => onChange({ ...caption, font: e.target.value })}
          className="rounded-full border border-surface/15 bg-surface/5 px-3 py-1.5 text-xs text-paper outline-none"
        >
          {FONT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ fontFamily: opt.value }}>
              {opt.label}
            </option>
          ))}
        </select>

        <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-surface/30 transition-transform hover:scale-110">
          <input
            type="color"
            value={caption.color}
            onChange={(e) => onChange({ ...caption, color: e.target.value })}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <span className="pointer-events-none flex h-full w-full items-center justify-center text-xs">🎨</span>
        </label>
      </div>

      {caption.text ? (
        <p className="text-center text-[11px] text-muted">Drag your caption anywhere on the strip above.</p>
      ) : null}
    </div>
  );
}
