"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";

interface PhotoStripProps {
  stripDataUrl: string;
  uploadError: string | null;
  onRetake: () => void;
}

export function PhotoStrip({ stripDataUrl, uploadError, onRetake }: PhotoStripProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex flex-col items-center gap-6"
    >
      <motion.img
        initial={{ filter: "brightness(3)" }}
        animate={{ filter: "brightness(1)" }}
        transition={{ duration: 0.6 }}
        src={stripDataUrl}
        alt="Your photobooth strip"
        className="max-h-[70vh] w-auto"
      />

      {uploadError ? <p className="text-xs text-curtain">{uploadError}</p> : null}

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onRetake}>
          Retake Session
        </Button>
        <a href={stripDataUrl} download={`photobooth-strip-${Date.now()}.png`}>
          <Button variant="primary">Download Strip</Button>
        </a>
      </div>
    </motion.div>
  );
}