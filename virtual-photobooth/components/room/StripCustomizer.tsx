"use client";

import { useRef } from "react";
import type { StripBackground } from "@/types";

const PRESET_COLORS = [
  { label: "White", value: "#FFFFFF" },
  { label: "Black", value: "#120F17" },
  { label: "Cream", value: "#F4E9DA" },
  { label: "Blush", value: "#FFD9E2" },
  { label: "Sky", value: "#D8E8FF" },
  { label: "Mint", value: "#D8F5E3" },
];

interface StripCustomizerProps {
  background: StripBackground;
  onChange: (background: StripBackground) => void;
}

export function StripCustomizer({ background, onChange }: StripCustomizerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onChange({ type: "image", dataUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // allow re-selecting the same file later
  }

  const isImage = background.type === "image";
  const activeColor = background.type === "color" ? background.value : null;

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-xs uppercase tracking-[0.2em] text-muted">Strip background</span>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {PRESET_COLORS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => onChange({ type: "color", value: preset.value })}
            aria-label={preset.label}
            className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
              activeColor === preset.value ? "border-flash" : "border-surface/20"
            }`}
            style={{ backgroundColor: preset.value }}
          />
        ))}

        {/* Custom color picker */}
        <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-surface/30 transition-transform hover:scale-110">
          <input
            type="color"
            value={activeColor ?? "#FFFFFF"}
            onChange={(e) => onChange({ type: "color", value: e.target.value })}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <span className="pointer-events-none flex h-full w-full items-center justify-center text-xs">
            🎨
          </span>
        </label>

        {/* Upload background image */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors ${
            isImage
              ? "border-flash bg-flash/10 text-flash"
              : "border-surface/20 bg-surface/5 text-paper hover:bg-surface/10"
          }`}
        >
          🖼️ Upload photo
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </div>
    </div>
  );
}