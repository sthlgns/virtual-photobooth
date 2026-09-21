"use client";

import { RefObject } from "react";
import { motion } from "framer-motion";
import { Spinner } from "@/components/ui/Spinner";
import type { CameraStatus } from "@/hooks/useCamera";

interface CameraPreviewProps {
  localVideoRef: RefObject<HTMLVideoElement>;
  remoteVideoRef: RefObject<HTMLVideoElement>;
  cameraStatus: CameraStatus;
  remoteStreamActive: boolean;
  cameraErrorMessage: string | null;
}

export function CameraPreview({
  localVideoRef,
  remoteVideoRef,
  cameraStatus,
  remoteStreamActive,
  cameraErrorMessage,
}: CameraPreviewProps) {
  return (
    <div className="grid w-full grid-cols-2 gap-4">
      <VideoTile label="You">
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

      <VideoTile label="Partner">
        <motion.video
          initial={{ opacity: 0 }}
          animate={{ opacity: remoteStreamActive ? 1 : 0 }}
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`h-full w-full -scale-x-100 object-cover ${remoteStreamActive ? "" : "hidden"}`}
        />
        {!remoteStreamActive ? <Spinner label="Connecting to partner's camera…" /> : null}
      </VideoTile>
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