// Core domain types shared across the app.

export type ParticipantSlot = "host" | "guest";

export type RoomStatus = "waiting" | "ready" | "in_session" | "completed";

export interface Room {
  id: string;
  code: string;
  status: RoomStatus;
  host_connected: boolean;
  guest_connected: boolean;
  created_at: string;
  last_active_at: string;
}

export type SessionPhase =
  | "idle"
  | "countdown"
  | "capturing"
  | "between_shots"
  | "generating"
  | "complete";

export interface SessionState {
  phase: SessionPhase;
  shotIndex: number; // 0, 1, 2 -> which of the 3 photos is in progress
  countdownValue: number | null; // 4,3,2,1 or null
  startedBy: ParticipantSlot | null;
  startedAt: number | null; // epoch ms, used to derive synchronized countdown
}

export interface CapturedPhoto {
  slot: ParticipantSlot;
  shotIndex: number;
  dataUrl: string;
}

// Personalizes the finished strip — shows through the borders and the
// gaps between captures. Chosen independently per device (see note above).
export type StripBackground = { type: "color"; value: string } | { type: "image"; dataUrl: string };

// WebRTC is used purely for the live partner camera preview. Supabase
// Realtime broadcast acts as the signaling transport to exchange these.
export type WebRTCSignalData =
  | { kind: "offer"; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; sdp: RTCSessionDescriptionInit }
  | { kind: "ice-candidate"; candidate: RTCIceCandidateInit };

// Broadcast event payloads sent over the Supabase Realtime channel for a room.
export type RealtimeEvent =
  | { type: "participant_joined"; slot: ParticipantSlot }
  | { type: "participant_left"; slot: ParticipantSlot }
  | { type: "session_start"; startedBy: ParticipantSlot; startedAt: number }
  | { type: "session_reset" }
  | { type: "strip_ready"; url: string }
  | { type: "webrtc_signal"; from: ParticipantSlot; data: WebRTCSignalData };

export interface RoomJoinError {
  code: "invalid_format" | "not_found" | "room_full" | "expired" | "unknown";
  message: string;
}
