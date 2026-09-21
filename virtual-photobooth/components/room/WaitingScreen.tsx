"use client";

import { motion } from "framer-motion";
import { RoomCodeDisplay } from "./RoomCodeDisplay";
import { Spinner } from "@/components/ui/Spinner";

export function WaitingScreen({ code }: { code: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center gap-8 text-center"
    >
      <RoomCodeDisplay code={code} />
      <Spinner label="Waiting for another user…" />
    </motion.div>
  );
}
