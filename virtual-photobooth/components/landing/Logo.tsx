"use client";

import { motion } from "framer-motion";

export function Logo() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="flex flex-col items-center gap-3 text-center"
    >
      <span className="animate-sprocketFloat text-4xl">Welcome to</span>
      <h1 className="font-display text-5xl font-medium tracking-tight text-paper sm:text-6xl">
        Virtual Photobooth
      </h1>
      <p className="max-w-sm text-balance text-sm text-muted">
        Made by Seth to take pics with Helena.
      </p>
    </motion.div>
  );
}
