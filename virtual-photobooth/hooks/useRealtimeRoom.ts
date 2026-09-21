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
  /** Every event received this session, oldest first. Never mutated in place — consumers should track how much of it they've already processed. */
  events: RealtimeEvent[];
  sendEvent: (event: RealtimeEvent) => Promise<void>;
}

/**
 * Owns the room's Supabase Realtime channel: tracks presence to know when
 * the partner is connected, and surfaces the latest broadcast event so
 * other hooks (session sync, WebRTC signaling) can react to it.
 */
export function useRealtimeRoom({ roomId, slot }: UseRealtimeRoomOptions): UseRealtimeRoomResult {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);

  useEffect(() => {
    if (!roomId || !slot) return;

    const partnerSlot: ParticipantSlot = slot === "host" ? "guest" : "host";

    const channel = connectToRoomChannel(roomId, slot, {
      onEvent: (event) => setEvents((prev) => [...prev, event]),
      onPresenceSync: (slots) => setPartnerConnected(slots.includes(partnerSlot)),
      onDisconnect: () => setConnectionError("Lost connection to the room. Reconnecting..."),
    });

    channelRef.current = channel;

    return () => {
      disconnectFromRoomChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, slot]);

  const sendEvent = useCallback(async (event: RealtimeEvent) => {
    if (!channelRef.current) return;
    await broadcastRoomEvent(channelRef.current, event);
  }, []);

  return { partnerConnected, connectionError, events, sendEvent };
}
