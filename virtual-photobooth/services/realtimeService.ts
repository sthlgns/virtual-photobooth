import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import { SUPABASE_REALTIME_CHANNEL_PREFIX } from "@/lib/constants";
import type { ParticipantSlot, RealtimeEvent } from "@/types";

type PresenceState = {
  slot: ParticipantSlot;
};

export interface RoomChannelHandlers {
  onEvent: (event: RealtimeEvent) => void;
  onPresenceSync: (connectedSlots: ParticipantSlot[]) => void;
  onDisconnect?: () => void;
}

/**
 * Opens (or reuses) the Supabase Realtime channel for a room, wiring up
 * broadcast events and presence tracking for the given participant slot.
 */
export function connectToRoomChannel(
  roomId: string,
  slot: ParticipantSlot,
  handlers: RoomChannelHandlers
): RealtimeChannel {
  const supabase = getSupabaseClient();
  const channel = supabase.channel(`${SUPABASE_REALTIME_CHANNEL_PREFIX}${roomId}`, {
    config: {
      broadcast: { self: false },
      presence: { key: slot },
    },
  });

  channel
    .on("broadcast", { event: "room_event" }, (payload) => {
      handlers.onEvent(payload.payload as RealtimeEvent);
    })
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<PresenceState>();
      const slots = Object.values(state)
        .flat()
        .map((p) => p.slot);
      handlers.onPresenceSync(slots);
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ slot });
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        handlers.onDisconnect?.();
      }
    });

  return channel;
}

export async function broadcastRoomEvent(
  channel: RealtimeChannel,
  event: RealtimeEvent
): Promise<void> {
  await channel.send({
    type: "broadcast",
    event: "room_event",
    payload: event,
  });
}

export function disconnectFromRoomChannel(channel: RealtimeChannel): void {
  channel.untrack();
  channel.unsubscribe();
}
