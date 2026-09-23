"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  connectToRoomChannel,
  broadcastRoomEvent,
  disconnectFromRoomChannel,
} from "@/services/realtimeService";
import type { ParticipantSlot, RealtimeEvent } from "@/types";

interface UseRealtimeRoomOptions {
  roomId: string | null;
  slot: ParticipantSlot | null;
}

interface UseRealtimeRoomResult {
  partnerConnected: boolean;
  connectionError: string | null;
  events: RealtimeEvent[];
  sendEvent: (event: RealtimeEvent) => Promise<void>;
}

const MAX_BACKOFF_MS = 10000;

export function useRealtimeRoom({ roomId, slot }: UseRealtimeRoomOptions): UseRealtimeRoomResult {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);

  useEffect(() => {
    if (!roomId || !slot) return;

    const partnerSlot: ParticipantSlot = slot === "host" ? "guest" : "host";
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const connect = () => {
      if (cancelled) return;
      // Guards against unsubscribe() below synchronously re-triggering this
      // same handler again — that self-triggering loop is what caused the
      // stack overflow.
      let handledDisconnect = false;

      const channel = connectToRoomChannel(roomId, slot, {
        onEvent: (event) => setEvents((prev) => [...prev, event]),
        onPresenceSync: (slots) => setPartnerConnected(slots.includes(partnerSlot)),
        onDisconnect: (reason) => {
          if (cancelled || handledDisconnect) return;
          handledDisconnect = true;

          console.log("[realtime] disconnect reason:", reason);
          setConnectionError("Lost connection to the room. Reconnecting…");

          disconnectFromRoomChannel(channel);
          if (channelRef.current === channel) channelRef.current = null;
          attempt += 1;
          const delay = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
          retryTimer = setTimeout(connect, delay);
        },
      });

      channelRef.current = channel;
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (channelRef.current) {
        disconnectFromRoomChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roomId, slot]);

  useEffect(() => {
    if (partnerConnected) setConnectionError(null);
  }, [partnerConnected]);

  const sendEvent = useCallback(async (event: RealtimeEvent) => {
    if (!channelRef.current) return;
    await broadcastRoomEvent(channelRef.current, event);
  }, []);

  return { partnerConnected, connectionError, events, sendEvent };
}
