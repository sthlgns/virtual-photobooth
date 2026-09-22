"use client";

import { useEffect, useRef, useState } from "react";
import type { ParticipantSlot, RealtimeEvent } from "@/types";

const SYNC_SAMPLES = 5;
const SAMPLE_INTERVAL_MS = 200;

interface UseClockSyncOptions {
  mySlot: ParticipantSlot | null;
  partnerConnected: boolean;
  events: RealtimeEvent[];
  sendEvent: (event: RealtimeEvent) => Promise<void>;
}

/**
 * Estimates how far the partner's system clock is ahead of or behind this
 * device's, using a handful of ping/pong round trips over the realtime
 * channel (NTP-style: send a timestamp, partner echoes back their own clock
 * reading, compare against round-trip time). The photo session uses this
 * offset to translate the initiator's "start the countdown at X" timestamp
 * into this device's own clock, so both sides land on the same visible
 * second even if their system clocks disagree.
 */
export function useClockSync({ mySlot, partnerConnected, events, sendEvent }: UseClockSyncOptions) {
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const processedCountRef = useRef(0);
  const pendingPingsRef = useRef<Set<number>>(new Set());
  const bestRttRef = useRef<number | null>(null);

  // Fire a short burst of pings shortly after the partner connects.
  useEffect(() => {
    if (!partnerConnected || !mySlot) return;

    bestRttRef.current = null;
    pendingPingsRef.current = new Set();
    let cancelled = false;
    let sent = 0;

    const sendPing = () => {
      if (cancelled || sent >= SYNC_SAMPLES) return;
      sent++;
      const t1 = Date.now();
      pendingPingsRef.current.add(t1);
      void sendEvent({ type: "clock_ping", from: mySlot, t1 });
      setTimeout(sendPing, SAMPLE_INTERVAL_MS);
    };

    const kickoff = setTimeout(sendPing, 300); // let the channel settle first
    return () => {
      cancelled = true;
      clearTimeout(kickoff);
    };
  }, [partnerConnected, mySlot, sendEvent]);

  // Answer incoming pings, and score incoming pong replies.
  useEffect(() => {
    if (!mySlot) return;
    const newEvents = events.slice(processedCountRef.current);
    processedCountRef.current = events.length;

    for (const event of newEvents) {
      if (event.type === "clock_ping" && event.from !== mySlot) {
        void sendEvent({ type: "clock_pong", from: mySlot, t1: event.t1, t2: Date.now() });
      } else if (event.type === "clock_pong" && event.from !== mySlot) {
        if (!pendingPingsRef.current.has(event.t1)) continue;
        pendingPingsRef.current.delete(event.t1);

        const t3 = Date.now();
        const rtt = t3 - event.t1;
        const offset = event.t2 - event.t1 - rtt / 2; // partnerClock - myClock

        // Keep only the lowest-latency sample — it's the most accurate one.
        if (bestRttRef.current === null || rtt < bestRttRef.current) {
          bestRttRef.current = rtt;
          setClockOffsetMs(offset);
        }
      }
    }
  }, [events, mySlot, sendEvent]);

  return { clockOffsetMs };
}
