"use client";

import { useState, useRef, KeyboardEvent, ClipboardEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { joinRoom } from "@/services/roomService";
import { PARTICIPANT_STORAGE_PREFIX, ROOM_CODE_LENGTH } from "@/lib/constants";

export function JoinRoomModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [digits, setDigits] = useState<string[]>(Array(ROOM_CODE_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join("");

  function updateDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < ROOM_CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, ROOM_CODE_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(ROOM_CODE_LENGTH).fill("");
    pasted.split("").forEach((d, i) => (next[i] = d));
    setDigits(next);
    inputsRef.current[Math.min(pasted.length, ROOM_CODE_LENGTH - 1)]?.focus();
  }

  async function handleSubmit() {
    if (code.length !== ROOM_CODE_LENGTH) {
      setError("Enter all 5 digits.");
      return;
    }
    setJoining(true);
    setError(null);
    const result = await joinRoom(code);
    setJoining(false);

    if ("error" in result) {
      setError(result.error.message);
      return;
    }

    localStorage.setItem(`${PARTICIPANT_STORAGE_PREFIX}${code}`, result.slot);
    router.push(`/room/${code}`);
  }

  function close() {
    setOpen(false);
    setDigits(Array(ROOM_CODE_LENGTH).fill(""));
    setError(null);
  }

  return (
    <>
      <Button variant="ghost" className="w-64" onClick={() => setOpen(true)}>
        Join Room
      </Button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
            onClick={close}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <GlassPanel className="w-full max-w-sm p-8">
                <h2 className="font-display text-2xl text-paper">Enter room code</h2>
                <p className="mt-1 text-sm text-muted">Ask your partner for their 5-digit code.</p>

                <div className="mt-6 flex justify-between gap-2">
                  {digits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        inputsRef.current[i] = el;
                      }}
                      value={digit}
                      onChange={(e) => updateDigit(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      onPaste={handlePaste}
                      inputMode="numeric"
                      maxLength={1}
                      aria-label={`Digit ${i + 1}`}
                      className="h-14 w-12 rounded-xl border border-surface/15 bg-surface/5 text-center font-mono text-2xl text-paper outline-none focus:border-flash focus:ring-2 focus:ring-flash/40"
                    />
                  ))}
                </div>

                {error ? <p className="mt-4 text-sm text-curtain">{error}</p> : null}

                <div className="mt-6 flex gap-3">
                  <Button variant="ghost" className="flex-1" onClick={close}>
                    Cancel
                  </Button>
                  <Button variant="primary" className="flex-1" onClick={handleSubmit} isLoading={joining}>
                    Join
                  </Button>
                </div>
              </GlassPanel>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}