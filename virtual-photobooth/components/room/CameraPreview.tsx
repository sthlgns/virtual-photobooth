"use client";

import { RefObject } from "react";
import { motion } from "framer-motion";
import { Spinner } from "@/components/ui/Spinner";
import type { CameraStatus } from "@/hooks/useCamera";
import type { ParticipantSlot } from "@/types";

interface CameraPreviewProps {
  localVideoRef: RefObject<HTMLVideoElement>;
  remoteVideoRef: RefObject<HTMLVideoElement>;
  cameraStatus: CameraStatus;
  remoteStreamActive: boolean;
  reconnecting: boolean;
  cameraErrorMessage: string | null;
  mySlot: ParticipantSlot | null;
}

export function CameraPreview({
  localVideoRef,
  remoteVideoRef,
  cameraStatus,
  remoteStreamActive,
  reconnecting,
  cameraErrorMessage,
  mySlot,
}: CameraPreviewProps) {
  const you = (
    <VideoTile key="you" label="You">
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full -scale-x-100 object-cover ${cameraStatus === "granted" ? "" : "hidden"}`}
      />
      {cameraStatus === "denied" || cameraStatus === "unavailable" ? (
        <ErrorState message={cameraErrorMessage ?? "Camera unavailable."} />
      ) : cameraStatus !== "granted" ? (
        <Spinner label="Starting camera…" />
      ) : null}
    </VideoTile>
  );

  const partner = (
    <VideoTile key="partner" label="Partner">
      <motion.video
        initial={{ opacity: 0 }}
        animate={{ opacity: remoteStreamActive ? 1 : 0 }}
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={`h-full w-full -scale-x-100 object-cover ${remoteStreamActive ? "" : "hidden"}`}
      />
      {!remoteStreamActive ? (
        <Spinner label={reconnecting ? "Reconnecting…" : "Connecting to partner's camera…"} />
      ) : null}
    </VideoTile>
  );

  // Host is always on the left, guest always on the right — on both
  // screens — so a couple pose (like a heart shape) lines up the same way
  // no matter who's viewing, and it matches the final strip's layout too.
  const [leftTile, rightTile] = mySlot === "guest" ? [partner, you] : [you, partner];

  return (
    <div className="grid w-full grid-cols-2 gap-4">
      {leftTile}
      {rightTile}
    </div>
  );
}

function VideoTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-[#15121C]">
      <div className="flex h-full w-full items-center justify-center">{children}</div>
      <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur-sm">
        {label}
      </span>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 text-center">
      <span className="text-2xl">🚫</span>
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}
