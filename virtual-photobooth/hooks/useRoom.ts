"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom, getRoomByCode, joinRoom, markParticipantLeft } from "@/services/roomService";
import { PARTICIPANT_STORAGE_PREFIX } from "@/lib/constants";
import type { ParticipantSlot, Room, RoomJoinError } from "@/types";

interface UseRoomResult {
  room: Room | null;
  mySlot: ParticipantSlot | null;
  loading: boolean;
  error: string | null;
}

/**
 * Resolves this browser's membership in a room by code: reclaims an existing
 * slot on refresh (via localStorage), or joins as the guest for a first visit.
 * Room creation happens separately via `useCreateRoom`.
 */
export function useRoom(code: string): UseRoomResult {
  const [room, setRoom] = useState<Room | null>(null);
  const [mySlot, setMySlot] = useState<ParticipantSlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const storageKey = `${PARTICIPANT_STORAGE_PREFIX}${code}`;

    (async () => {
      const remembered = typeof window !== "undefined" ? (localStorage.getItem(storageKey) as ParticipantSlot | null) : null;

      if (remembered) {
        const existing = await getRoomByCode(code);
        if (cancelled) return;
        if (!existing) {
          setError("This room has ended.");
          setLoading(false);
          return;
        }
        setRoom(existing);
        setMySlot(remembered);
        setLoading(false);
        return;
      }

      const result = await joinRoom(code);
      if (cancelled) return;

      if ("error" in result) {
        const joinError: RoomJoinError = result.error;
        setError(joinError.message);
        setLoading(false);
        return;
      }

      localStorage.setItem(storageKey, result.slot);
      setRoom(result.room);
      setMySlot(result.slot);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    if (!room || !mySlot) return;

    const handleUnload = () => {
      // Best-effort cleanup; keepalive lets the request outlive page teardown.
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rooms?id=eq.${room.id}`;
      const field = mySlot === "host" ? "host_connected" : "guest_connected";
      void fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ [field]: false }),
        keepalive: true,
      }).catch(() => undefined);
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      void markParticipantLeft(room.id, mySlot);
    };
  }, [room, mySlot]);

  return { room, mySlot, loading, error };
}

/** Separate hook for the landing page's "Create Room" action (navigates on success). */
export function useCreateRoom() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const room = await createRoom();
      localStorage.setItem(`${PARTICIPANT_STORAGE_PREFIX}${room.code}`, "host");
      router.push(`/room/${room.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create a room. Please try again.");
      setCreating(false);
    }
  }, [router]);

  return { create, creating, error };
}
