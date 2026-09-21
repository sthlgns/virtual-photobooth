"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export function RoomCodeDisplay({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API can fail without HTTPS/permissions; the code is still visible.
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-3"
    >
      <span className="text-xs uppercase tracking-[0.2em] text-muted">Room code</span>
      <div className="relative flex items-center gap-1 rounded-2xl border border-dashed border-surface/25 bg-surface/5 px-6 py-4">
        {code.split("").map((digit, i) => (
          <span key={i} className="font-mono text-4xl tracking-widest text-flash">
            {digit}
          </span>
        ))}
      </div>
      <button
        onClick={handleCopy}
        className="rounded-full border border-surface/15 bg-surface/5 px-4 py-1.5 text-xs text-paper transition-colors hover:bg-surface/10"
      >
        {copied ? "Copied ✓" : "Copy code"}
      </button>
    </motion.div>
  );
}