"use client";

import { AnimatePresence, motion } from "framer-motion";

interface ErrorToastProps {
  message: string | null;
  onDismiss?: () => void;
}

export function ErrorToast({ message, onDismiss }: ErrorToastProps) {
  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed bottom-6 left-1/2 z-50 flex max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl border border-curtain/30 bg-canvas-soft/95 px-5 py-4 text-sm text-paper shadow-glass backdrop-blur-glass"
          role="alert"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-curtain" />
          <span>{message}</span>
          {onDismiss ? (
            <button
              onClick={onDismiss}
              className="ml-2 text-muted transition-colors hover:text-paper"
              aria-label="Dismiss"
            >
              ✕
            </button>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}