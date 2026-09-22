"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { captureVideoFrame } from "@/utils/captureFrame";

export type CameraStatus = "idle" | "requesting" | "granted" | "denied" | "unavailable";

interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  stream: MediaStream | null;
  status: CameraStatus;
  errorMessage: string | null;
  requestCamera: () => Promise<MediaStream | null>;
  captureFrame: () => string | null;
}

export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const requestCamera = useCallback(async (): Promise<MediaStream | null> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unavailable");
      setErrorMessage("This browser doesn't support camera access.");
      return null;
    }

    setStatus("requesting");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 960 }, facingMode: "user" },
        audio: false,
      });

      // If the OS/browser ever yanks the camera away mid-session (another
      // app grabs it, device sleeps, etc.), the track fires 'ended'. Flipping
      // status back to "idle" lets the room page's existing effect
      // automatically re-acquire a fresh stream — so a dropped camera
      // recovers on its own instead of needing the room rebuilt.
      mediaStream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          setStream((current) => {
            current?.getTracks().forEach((t) => t.stop());
            return null;
          });
          setStatus("idle");
        };
      });

      setStream(mediaStream);
      setStatus("granted");
      setErrorMessage(null);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      return mediaStream;
    } catch (err) {
      setStatus("denied");
      setErrorMessage(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera access was denied. Allow camera access in your browser settings and try again."
          : "Couldn't access your camera. Make sure it isn't in use by another app."
      );
      return null;
    }
  }, []);

  const captureFrame = useCallback((): string | null => {
    return captureVideoFrame(videoRef.current);
  }, []);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { videoRef, stream, status, errorMessage, requestCamera, captureFrame };
}
