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
} from "@/types";

const SHOT_CYCLE_MS = COUNTDOWN_SECONDS * 1000 + PAUSE_BETWEEN_SHOTS_MS;
// Small buffer so the broadcast has time to reach both browsers before the
// countdown visually begins — this is what keeps the two sides in sync.
const START_BUFFER_MS = 900;

interface UsePhotoSessionOptions {
  roomId: string | null;
  mySlot: ParticipantSlot | null;
  events: RealtimeEvent[];
  sendEvent: (event: RealtimeEvent) => Promise<void>;
  captureLocalFrame: () => string | null;
  captureRemoteFrame: () => string | null;
}

interface UsePhotoSessionResult {
  session: SessionState;
  photos: CapturedPhoto[];
  stripDataUrl: string | null;
  stripUploadError: string | null;
  background: StripBackground;
  updateBackground: (background: StripBackground) => Promise<void>;
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

  const capturedShotsRef = useRef<Set<number>>(new Set());
  const rafRef = useRef<number | null>(null);
  const generatingRef = useRef(false);
  const processedCountRef = useRef(0);

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

  // Lets the person re-style their own copy of the strip after it's generated,
  // without needing to retake the photos.
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

  // React to the partner starting or resetting a session. Processes every
  // unseen event in order (not just the latest) so a session_start followed
  // quickly by a session_reset can't have the reset silently swallowed.
  useEffect(() => {
    const newEvents = events.slice(processedCountRef.current);
    processedCountRef.current = events.length;

    for (const event of newEvents) {
      if (event.type === "session_start") {
        beginLocalSession(event.startedBy, event.startedAt);
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

  // Drive the state machine off a shared wall-clock timestamp so both
  // browsers land on the same phase/countdown value independently.
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

      // Fire each shot's capture exactly once, right as its countdown hits
      // zero. Checked independently per shot index (rather than off the
      // display `shotIndex` above) so a delayed animation frame can't cause
      // the transition into "generating" to skip the final shot's capture.
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
        return; // let the generation effect below take over
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [session.phase, session.startedAt, mySlot, captureLocalFrame, captureRemoteFrame]);

  // Once all shots are in, composite the strip and mark the session complete.
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
    startSession,
    retakeSession,
  };
}