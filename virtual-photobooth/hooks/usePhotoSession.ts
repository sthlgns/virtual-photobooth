"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { COUNTDOWN_SECONDS, PAUSE_BETWEEN_SHOTS_MS, TOTAL_PHOTOS } from "@/lib/constants";
import { generatePhotoStrip, DEFAULT_STRIP_BACKGROUND } from "@/utils/canvasStrip";
import { playShutterSound } from "@/utils/sound";
import { uploadStrip } from "@/services/storageService";
import type {
  CapturedPhoto,
  ParticipantSlot,
  RealtimeEvent,
  SessionPhase,
  SessionState,
  StripBackground,
  StripCaption,
} from "@/types";

const SHOT_CYCLE_MS = COUNTDOWN_SECONDS * 1000 + PAUSE_BETWEEN_SHOTS_MS;
const START_BUFFER_MS = 900;

const DEFAULT_CAPTION: StripCaption = {
  text: "",
  font: "Caveat",
  color: "#120F17",
  xPct: 0.5,
  yPct: 0.95,
};

interface UsePhotoSessionOptions {
  roomId: string | null;
  mySlot: ParticipantSlot | null;
  events: RealtimeEvent[];
  sendEvent: (event: RealtimeEvent) => Promise<void>;
  captureLocalFrame: () => string | null;
  captureRemoteFrame: () => string | null;
  /** Estimated (partner's clock − my clock) in ms, from useClockSync. */
  clockOffsetMs: number;
}

interface UsePhotoSessionResult {
  session: SessionState;
  photos: CapturedPhoto[];
  stripDataUrl: string | null;
  stripUploadError: string | null;
  background: StripBackground;
  updateBackground: (background: StripBackground) => Promise<void>;
  caption: StripCaption;
  updateCaption: (caption: StripCaption) => void;
  startSession: () => Promise<void>;
  retakeSession: () => Promise<void>;
}

function shotStartTime(startedAt: number, shotIndex: number): number {
  return startedAt + shotIndex * SHOT_CYCLE_MS;
}

function phaseAt(startedAt: number, now: number): { phase: SessionPhase; shotIndex: number; countdownValue: number | null } {
  const elapsed = now - startedAt;
  const totalActiveMs = TOTAL_PHOTOS * SHOT_CYCLE_MS - PAUSE_BETWEEN_SHOTS_MS;

  if (elapsed < 0) return { phase: "countdown", shotIndex: 0, countdownValue: COUNTDOWN_SECONDS };
  if (elapsed >= totalActiveMs) return { phase: "generating", shotIndex: TOTAL_PHOTOS, countdownValue: null };

  const shotIndex = Math.min(TOTAL_PHOTOS - 1, Math.floor(elapsed / SHOT_CYCLE_MS));
  const withinShot = elapsed - shotIndex * SHOT_CYCLE_MS;

  if (withinShot < COUNTDOWN_SECONDS * 1000) {
    const remainingMs = COUNTDOWN_SECONDS * 1000 - withinShot;
    const countdownValue = Math.max(1, Math.ceil(remainingMs / 1000));
    return { phase: "countdown", shotIndex, countdownValue };
  }

  return { phase: "between_shots", shotIndex, countdownValue: null };
}

export function usePhotoSession({
  roomId,
  mySlot,
  events,
  sendEvent,
  captureLocalFrame,
  captureRemoteFrame,
  clockOffsetMs,
}: UsePhotoSessionOptions): UsePhotoSessionResult {
  const [session, setSession] = useState<SessionState>({
    phase: "idle",
    shotIndex: 0,
    countdownValue: null,
    startedBy: null,
    startedAt: null,
  });
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [stripDataUrl, setStripDataUrl] = useState<string | null>(null);
  const [stripUploadError, setStripUploadError] = useState<string | null>(null);
  const [background, setBackground] = useState<StripBackground>(DEFAULT_STRIP_BACKGROUND);
  const [caption, setCaption] = useState<StripCaption>(DEFAULT_CAPTION);

  const capturedShotsRef = useRef<Set<number>>(new Set());
  const rafRef = useRef<number | null>(null);
  const generatingRef = useRef(false);
  const processedCountRef = useRef(0);
  const clockOffsetRef = useRef(clockOffsetMs);
  clockOffsetRef.current = clockOffsetMs;

  const beginLocalSession = useCallback((startedBy: ParticipantSlot, startedAt: number) => {
    capturedShotsRef.current = new Set();
    generatingRef.current = false;
    setPhotos([]);
    setStripDataUrl(null);
    setStripUploadError(null);
    setSession({ phase: "countdown", shotIndex: 0, countdownValue: COUNTDOWN_SECONDS, startedBy, startedAt });
  }, []);

  const startSession = useCallback(async () => {
    if (!mySlot) return;
    const startedAt = Date.now() + START_BUFFER_MS;
    beginLocalSession(mySlot, startedAt);
    await sendEvent({ type: "session_start", startedBy: mySlot, startedAt });
  }, [mySlot, sendEvent, beginLocalSession]);

  const retakeSession = useCallback(async () => {
    capturedShotsRef.current = new Set();
    generatingRef.current = false;
    setPhotos([]);
    setStripDataUrl(null);
    setStripUploadError(null);
    setSession({ phase: "idle", shotIndex: 0, countdownValue: null, startedBy: null, startedAt: null });
    await sendEvent({ type: "session_reset" });
  }, [sendEvent]);

  const updateBackground = useCallback(
    async (bg: StripBackground) => {
      setBackground(bg);
      if (photos.length === 0) return;
      try {
        const dataUrl = await generatePhotoStrip(photos, bg);
        setStripDataUrl(dataUrl);
        setStripUploadError(null);
      } catch {
        setStripUploadError("Couldn't apply that background. Try a different one.");
      }
    },
    [photos]
  );

  const updateCaption = useCallback((next: StripCaption) => {
    setCaption(next);
  }, []);

  useEffect(() => {
    const newEvents = events.slice(processedCountRef.current);
    processedCountRef.current = events.length;

    for (const event of newEvents) {
      if (event.type === "session_start") {
        // Events reaching us here always originated from the partner (the
        // realtime channel doesn't echo our own broadcasts back to us), so
        // their timestamp is in the partner's clock — translate it into
        // ours using the offset useClockSync measured, so both sides land
        // on the same visible countdown second.
        const adjustedStartedAt = event.startedAt - clockOffsetRef.current;
        beginLocalSession(event.startedBy, adjustedStartedAt);
      } else if (event.type === "session_reset") {
        capturedShotsRef.current = new Set();
        generatingRef.current = false;
        setPhotos([]);
        setStripDataUrl(null);
        setStripUploadError(null);
        setSession({ phase: "idle", shotIndex: 0, countdownValue: null, startedBy: null, startedAt: null });
      }
    }
  }, [events, beginLocalSession]);

  useEffect(() => {
    if (
      session.phase === "idle" ||
      session.phase === "complete" ||
      session.phase === "generating" ||
      !session.startedAt
    )
      return;

    const tick = () => {
      const startedAt = session.startedAt as number;
      const now = Date.now();
      const { phase, shotIndex, countdownValue } = phaseAt(startedAt, now);

      setSession((prev) =>
        prev.phase === phase && prev.shotIndex === shotIndex && prev.countdownValue === countdownValue
          ? prev
          : { ...prev, phase, shotIndex, countdownValue }
      );

      for (let s = 0; s < TOTAL_PHOTOS; s++) {
        const captureAt = shotStartTime(startedAt, s) + COUNTDOWN_SECONDS * 1000;
        if (now >= captureAt && !capturedShotsRef.current.has(s)) {
          capturedShotsRef.current.add(s);
          playShutterSound();
          if (mySlot) {
            const localUrl = captureLocalFrame();
            const remoteUrl = captureRemoteFrame();
            const partnerSlot: ParticipantSlot = mySlot === "host" ? "guest" : "host";
            setPhotos((prev) => {
              const next = [...prev];
              if (localUrl) next.push({ slot: mySlot, shotIndex: s, dataUrl: localUrl });
              if (remoteUrl) next.push({ slot: partnerSlot, shotIndex: s, dataUrl: remoteUrl });
              return next;
            });
          }
        }
      }

      if (phase === "generating" && !generatingRef.current) {
        generatingRef.current = true;
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [session.phase, session.startedAt, mySlot, captureLocalFrame, captureRemoteFrame]);

  useEffect(() => {
    if (session.phase !== "generating" || stripDataUrl) return;

    let cancelled = false;
    (async () => {
      try {
        const dataUrl = await generatePhotoStrip(photos, background);
        if (cancelled) return;
        setStripDataUrl(dataUrl);
        setSession((prev) => ({ ...prev, phase: "complete" }));

        if (roomId) {
          try {
            await uploadStrip(roomId, dataUrl);
          } catch {
            if (!cancelled) setStripUploadError("Saved locally, but couldn't back this strip up to the cloud.");
          }
        }
      } catch {
        if (!cancelled) setStripUploadError("Something went wrong generating your strip. You can retake the session.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session.phase, photos, roomId, stripDataUrl, background]);

  return {
    session,
    photos,
    stripDataUrl,
    stripUploadError,
    background,
    updateBackground,
    caption,
    updateCaption,
    startSession,
    retakeSession,
  };
}
