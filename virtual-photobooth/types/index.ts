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
  shotIndex: number;
  countdownValue: number | null;
  startedBy: ParticipantSlot | null;
  startedAt: number | null;
}

export interface CapturedPhoto {
  slot: ParticipantSlot;
  shotIndex: number;
  dataUrl: string;
}

// Personalizes the finished strip — shows through the borders and the
// gaps between captures. Chosen independently per device.
export type StripBackground = { type: "color"; value: string } | { type: "image"; dataUrl: string };

// An optional caption drawn on the strip, positioned by dragging.
// xPct/yPct are 0–1 fractions of the strip's width/height, so the
// position scales correctly regardless of how large the strip is rendered.
export interface StripCaption {
  text: string;
  font: string;
  color: string;
  xPct: number;
  yPct: number;
}

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
  | { type: "webrtc_signal"; from: ParticipantSlot; data: WebRTCSignalData }
  | { type: "clock_ping"; from: ParticipantSlot; t1: number }
  | { type: "clock_pong"; from: ParticipantSlot; t1: number; t2: number };

export interface RoomJoinError {
  code: "invalid_format" | "not_found" | "room_full" | "expired" | "unknown";
  message: string;
}
