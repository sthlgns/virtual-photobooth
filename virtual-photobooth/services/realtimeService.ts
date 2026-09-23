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
  onDisconnect?: (reason: string) => void;
}

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
    .subscribe(async (status, err) => {
      // Logged so the real reason (not just "it failed") shows up in the
      // browser console when something goes wrong.
      console.log("[realtime] channel status:", status, err ?? "");

      if (status === "SUBSCRIBED") {
        await channel.track({ slot });
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        handlers.onDisconnect?.(err?.message ?? status);
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
