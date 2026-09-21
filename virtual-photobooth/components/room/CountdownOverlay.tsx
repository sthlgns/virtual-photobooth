"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { SessionState } from "@/types";
import { TOTAL_PHOTOS } from "@/lib/constants";

export function CountdownOverlay({ session }: { session: SessionState }) {
  const showCountdown = session.phase === "countdown" && session.countdownValue !== null;
  const showFlash = session.phase === "between_shots";

  return (
    <>
      <AnimatePresence>
        {showCountdown ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-ink/40 backdrop-blur-sm"
          >
            <span className="text-xs uppercase tracking-[0.3em] text-paper/70">
              Shot {session.shotIndex + 1} of {TOTAL_PHOTOS}
            </span>
            <AnimatePresence mode="wait">
              <motion.span
                key={session.countdownValue}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.4, opacity: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="font-display text-9xl font-medium text-flash drop-shadow-glow"
              >
                {session.countdownValue === 1 ? "📸" : session.countdownValue}
              </motion.span>
            </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Camera flash: a bright white pulse timed to the shutter moment. */}
      <AnimatePresence>
        {showFlash ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="pointer-events-none absolute inset-0 z-40 bg-white"
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}
