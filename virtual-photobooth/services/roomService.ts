import { getSupabaseClient } from "@/lib/supabase/client";
import { generateRoomCode, isValidRoomCodeFormat } from "@/utils/roomCode";
import type { ParticipantSlot, Room, RoomJoinError } from "@/types";

const MAX_CODE_COLLISION_RETRIES = 5;

/**
 * Creates a new room with a unique 5-digit code and claims the "host" slot.
 * Retries on the rare chance of a code collision (unique constraint violation).
 */
export async function createRoom(): Promise<Room> {
  const supabase = getSupabaseClient();

  for (let attempt = 0; attempt < MAX_CODE_COLLISION_RETRIES; attempt++) {
    const code = generateRoomCode();

    const { data, error } = await supabase
      .from("rooms")
      .insert({
        code,
        status: "waiting",
        host_connected: true,
        guest_connected: false,
      })
      .select()
      .single();

    if (!error && data) {
      return data as Room;
    }

    // 23505 = unique_violation in Postgres. Retry with a fresh code.
    if (error && error.code !== "23505") {
      throw new Error(`Failed to create room: ${error.message}`);
    }
  }

  throw new Error("Could not generate a unique room code. Please try again.");
}

/**
 * Attempts to join an existing room as the "guest". Uses a conditional update
 * so two simultaneous joiners can't both claim the guest slot.
 */
export async function joinRoom(
  rawCode: string
): Promise<{ room: Room; slot: ParticipantSlot } | { error: RoomJoinError }> {
  const code = rawCode.trim();

  if (!isValidRoomCodeFormat(code)) {
    return {
      error: {
        code: "invalid_format",
        message: "Room codes are exactly 5 digits.",
      },
    };
  }

  const supabase = getSupabaseClient();

  const { data: room, error: fetchError } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (fetchError) {
    return { error: { code: "unknown", message: "Something went wrong. Please try again." } };
  }

  if (!room) {
    return { error: { code: "not_found", message: "That room code doesn't exist." } };
  }

  if (room.guest_connected) {
    return { error: { code: "room_full", message: "That room already has two people in it." } };
  }

  // Conditionally claim the guest slot only if it's still free.
  const { data: updated, error: updateError } = await supabase
    .from("rooms")
    .update({ guest_connected: true, status: "ready" })
    .eq("id", room.id)
    .eq("guest_connected", false)
    .select()
    .single();

  if (updateError || !updated) {
    return { error: { code: "room_full", message: "That room just filled up. Try another code." } };
  }

  return { room: updated as Room, slot: "guest" };
}

export async function getRoomByCode(code: string): Promise<Room | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.from("rooms").select("*").eq("code", code).maybeSingle();
  return (data as Room) ?? null;
}

export async function markParticipantLeft(roomId: string, slot: ParticipantSlot): Promise<void> {
  const supabase = getSupabaseClient();
  const field = slot === "host" ? "host_connected" : "guest_connected";
  await supabase
    .from("rooms")
    .update({ [field]: false, status: "waiting" })
    .eq("id", roomId);
}

export async function touchRoomActivity(roomId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase
    .from("rooms")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", roomId);
}

export async function markSessionComplete(roomId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.from("rooms").update({ status: "completed" }).eq("id", roomId);
}

export async function resetSessionStatus(roomId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.from("rooms").update({ status: "ready" }).eq("id", roomId);
}
