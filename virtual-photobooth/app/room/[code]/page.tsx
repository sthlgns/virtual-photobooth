"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useRoom } from "@/hooks/useRoom";
import { useRealtimeRoom } from "@/hooks/useRealtimeRoom";
import { useCamera } from "@/hooks/useCamera";
import { useWebRTCPeer } from "@/hooks/useWebRTCPeer";
import { usePhotoSession } from "@/hooks/usePhotoSession";
import { WaitingScreen } from "@/components/room/WaitingScreen";
import { CameraPreview } from "@/components/room/CameraPreview";
import { CountdownOverlay } from "@/components/room/CountdownOverlay";
import { SessionControls } from "@/components/room/SessionControls";
import { PhotoStrip } from "@/components/room/PhotoStrip";
import { StripCustomizer } from "@/components/room/StripCustomizer";
import { CaptionEditor } from "@/components/room/CaptionEditor";
import { RoomCodeDisplay } from "@/components/room/RoomCodeDisplay";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorToast } from "@/components/ui/ErrorToast";
import { Button } from "@/components/ui/Button";
import { captureVideoFrame } from "@/utils/captureFrame";

export default function RoomPage({ params }: { params: { code: string } }) {
  const code = params.code;
  const { room, mySlot, loading, error } = useRoom(code);
  const { partnerConnected, connectionError, events, sendEvent } = useRealtimeRoom({
    roomId: room?.id ?? null,
    slot: mySlot,
  });
  const { videoRef: localVideoRef, status: cameraStatus, errorMessage: cameraErrorMessage, requestCamera, stream } =
    useCamera();
  const { remoteVideoRef, remoteStreamActive, reconnecting } = useWebRTCPeer({
    localStream: stream,
    mySlot,
    partnerConnected,
    events,
    sendEvent,
  });

  const captureLocalFrame = useCallback(() => captureVideoFrame(localVideoRef.current), [localVideoRef]);
  const captureRemoteFrame = useCallback(() => captureVideoFrame(remoteVideoRef.current), [remoteVideoRef]);

  const {
    session,
    stripDataUrl,
    stripUploadError,
    background,
    updateBackground,
    caption,
    updateCaption,
    startSession,
    retakeSession,
  } = usePhotoSession({
    roomId: room?.id ?? null,
    mySlot,
    events,
    sendEvent,
    captureLocalFrame,
    captureRemoteFrame,
  });

  const [partnerLeftDuringSession, setPartnerLeftDuringSession] = useState(false);
  const wasPartnerConnected = useRef(false);

  useEffect(() => {
    if (partnerConnected && cameraStatus === "idle") {
      void requestCamera();
    }
  }, [partnerConnected, cameraStatus, requestCamera]);

  useEffect(() => {
    if (wasPartnerConnected.current && !partnerConnected && session.phase !== "idle" && session.phase !== "complete") {
      setPartnerLeftDuringSession(true);
      void retakeSession();
    }
    wasPartnerConnected.current = partnerConnected;
  }, [partnerConnected, session.phase, retakeSession]);

  function handleExitClick(e: React.MouseEvent) {
    const midSession = session.phase !== "idle" && session.phase !== "complete";
    if (midSession && !window.confirm("You're in the middle of a session — leave anyway?")) {
      e.preventDefault();
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Spinner label="Finding your room…" />
      </main>
    );
  }

  if (error || !room || !mySlot) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-3xl">🎞️</span>
        <p className="max-w-xs text-paper">{error ?? "This room isn't available anymore."}</p>
        <Link href="/">
          <Button variant="ghost">Back home</Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-10 px-6 py-16">
      <Link
        href="/"
        onClick={handleExitClick}
        className="fixed left-4 top-4 z-50 flex h-10 items-center gap-1.5 rounded-full border border-surface/15 bg-surface/5 px-4 text-sm text-paper backdrop-blur-glass transition-colors hover:bg-surface/10"
      >
        ← Exit
      </Link>

      {!partnerConnected ? (
        <WaitingScreen code={room.code} />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex w-full max-w-2xl flex-col items-center gap-8"
        >
          <RoomCodeDisplay code={room.code} />

          <div className="relative w-full">
            <CameraPreview
              localVideoRef={localVideoRef}
              remoteVideoRef={remoteVideoRef}
              cameraStatus={cameraStatus}
              remoteStreamActive={remoteStreamActive}
              reconnecting={reconnecting}
              cameraErrorMessage={cameraErrorMessage}
            />
            <CountdownOverlay session={session} />
          </div>

          {session.phase === "idle" && cameraStatus === "granted" ? (
            <SessionControls onStart={startSession} disabled={!remoteStreamActive} />
          ) : null}

          {session.phase === "complete" && stripDataUrl ? (
            <>
              <PhotoStrip
                stripDataUrl={stripDataUrl}
                uploadError={stripUploadError}
                caption={caption}
                onCaptionChange={updateCaption}
                onRetake={retakeSession}
              />
              <StripCustomizer background={background} onChange={updateBackground} />
              <CaptionEditor caption={caption} onChange={updateCaption} />
            </>
          ) : null}
        </motion.div>
      )}

      <ErrorToast message={connectionError} />
      <ErrorToast
        message={partnerLeftDuringSession ? "Your partner disconnected, so the session was reset." : null}
        onDismiss={() => setPartnerLeftDuringSession(false)}
      />
    </main>
  );
}
