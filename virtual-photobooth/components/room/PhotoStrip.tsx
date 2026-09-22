"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { compositeStripWithCaption } from "@/utils/compositeCaption";
import type { StripCaption } from "@/types";

interface PhotoStripProps {
  stripDataUrl: string;
  uploadError: string | null;
  caption: StripCaption;
  onCaptionChange: (caption: StripCaption) => void;
  onRetake: () => void;
}

export function PhotoStrip({ stripDataUrl, uploadError, caption, onCaptionChange, onRetake }: PhotoStripProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [downloading, setDownloading] = useState(false);

  function positionFromPointer(clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const xPct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const yPct = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    return { xPct, yPct };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLSpanElement>) {
    e.preventDefault();
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLSpanElement>) {
    if (!draggingRef.current) return;
    const pos = positionFromPointer(e.clientX, e.clientY);
    if (pos) onCaptionChange({ ...caption, ...pos });
  }

  function handlePointerUp(e: React.PointerEvent<HTMLSpanElement>) {
    draggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const finalUrl = caption.text.trim()
        ? await compositeStripWithCaption(stripDataUrl, caption)
        : stripDataUrl;
      const link = document.createElement("a");
      link.href = finalUrl;
      link.download = `photobooth-strip-${Date.now()}.png`;
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex flex-col items-center gap-6"
    >
      <div
        ref={containerRef}
        className="relative inline-block max-h-[70vh]"
        style={{ containerType: "inline-size" }}
      >
        <motion.img
          initial={{ filter: "brightness(3)" }}
          animate={{ filter: "brightness(1)" }}
          transition={{ duration: 0.6 }}
          src={stripDataUrl}
          alt="Your photobooth strip"
          className="block max-h-[70vh] w-auto select-none"
          draggable={false}
        />

        {caption.text ? (
          <span
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{
              position: "absolute",
              left: `${caption.xPct * 100}%`,
              top: `${caption.yPct * 100}%`,
              transform: "translate(-50%, -50%)",
              fontFamily: caption.font,
              color: caption.color,
              fontSize: "clamp(12px, 5cqw, 40px)",
              cursor: "grab",
              touchAction: "none",
              whiteSpace: "nowrap",
              userSelect: "none",
            }}
          >
            {caption.text}
          </span>
        ) : null}
      </div>

      {uploadError ? <p className="text-xs text-curtain">{uploadError}</p> : null}

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onRetake}>
          Retake Session
        </Button>
        <Button variant="primary" onClick={handleDownload} isLoading={downloading}>
          Download Strip
        </Button>
      </div>
    </motion.div>
  );
}
