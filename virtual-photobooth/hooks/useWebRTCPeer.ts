"use client";

import { useEffect, useRef, useState } from "react";
import type { ParticipantSlot, RealtimeEvent, WebRTCSignalData } from "@/types";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

// A "disconnected" state often self-heals from a brief network blip — give
// it this long before forcing a full reconnect.
const DISCONNECT_GRACE_MS = 6000;
// If it never reaches "connected" at all within this long, something's
// blocking it — retry rather than leaving the preview stuck forever.
const INITIAL_CONNECT_TIMEOUT_MS = 14000;

interface UseWebRTCPeerOptions {
  localStream: MediaStream | null;
  mySlot: ParticipantSlot | null;
  partnerConnected: boolean;
  events: RealtimeEvent[];
  sendEvent: (event: RealtimeEvent) => Promise<void>;
}

interface UseWebRTCPeerResult {
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  remoteStreamActive: boolean;
  reconnecting: boolean;
}

/**
 * Automatically rebuilds the peer connection if it fails, stalls, or never
 * connects in the first place — previously any of those required leaving
 * and recreating the whole room to recover from.
 */
export function useWebRTCPeer({
  localStream,
  mySlot,
  partnerConnected,
  events,
  sendEvent,
}: UseWebRTCPeerOptions): UseWebRTCPeerResult {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const processedCountRef = useRef(0);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteStreamActive, setRemoteStreamActive] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectTick, setReconnectTick] = useState(0);

  useEffect(() => {
    if (!localStream || !mySlot || !partnerConnected) return;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    pendingCandidates.current = [];
    processedCountRef.current = events.length;
    setReconnecting(false);

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    pc.ontrack = (event) => {
      const [incomingStream] = event.streams;
      if (incomingStream) setRemoteStream(incomingStream);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void sendEvent({
          type: "webrtc_signal",
          from: mySlot,
          data: { kind: "ice-candidate", candidate: event.candidate.toJSON() },
        });
      }
    };

    let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setReconnecting(false);
        if (disconnectTimer) {
          clearTimeout(disconnectTimer);
          disconnectTimer = null;
        }
        return;
      }

      if (pc.connectionState === "failed") {
        setRemoteStream(null);
        setRemoteStreamActive(false);
        setReconnectTick((n) => n + 1);
        return;
      }

      if (pc.connectionState === "disconnected") {
        setReconnecting(true);
        if (disconnectTimer) clearTimeout(disconnectTimer);
        disconnectTimer = setTimeout(() => {
          setRemoteStream(null);
          setRemoteStreamActive(false);
          setReconnectTick((n) => n + 1);
        }, DISCONNECT_GRACE_MS);
      }
    };

    const initialConnectTimer = setTimeout(() => {
      if (pc.connectionState !== "connected") {
        setRemoteStream(null);
        setRemoteStreamActive(false);
        setReconnectTick((n) => n + 1);
      }
    }, INITIAL_CONNECT_TIMEOUT_MS);

    if (mySlot === "host") {
      pc.onnegotiationneeded = async () => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        void sendEvent({ type: "webrtc_signal", from: mySlot, data: { kind: "offer", sdp: offer } });
      };
    }

    return () => {
      if (disconnectTimer) clearTimeout(disconnectTimer);
      clearTimeout(initialConnectTimer);
      pc.close();
      pcRef.current = null;
      setRemoteStream(null);
      setRemoteStreamActive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream, mySlot, partnerConnected, reconnectTick]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      setRemoteStreamActive(true);
      setReconnecting(false);
    }
  }, [remoteStream]);

  useEffect(() => {
    if (!mySlot) return;
    const pc = pcRef.current;
    if (!pc) return;

    const newEvents = events.slice(processedCountRef.current);
    processedCountRef.current = events.length;

    for (const event of newEvents) {
      if (event.type !== "webrtc_signal" || event.from === mySlot) continue;
      void handleSignal(pc, event.data, mySlot, sendEvent, pendingCandidates);
    }
  }, [events, mySlot, sendEvent]);

  return { remoteVideoRef, remoteStreamActive, reconnecting };
}

async function handleSignal(
  pc: RTCPeerConnection,
  data: WebRTCSignalData,
  mySlot: ParticipantSlot,
  sendEvent: (event: RealtimeEvent) => Promise<void>,
  pendingCandidates: React.MutableRefObject<RTCIceCandidateInit[]>
) {
  if (data.kind === "offer") {
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    await flushPendingCandidates(pc, pendingCandidates);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    void sendEvent({ type: "webrtc_signal", from: mySlot, data: { kind: "answer", sdp: answer } });
  } else if (data.kind === "answer") {
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    await flushPendingCandidates(pc, pendingCandidates);
  } else if (data.kind === "ice-candidate") {
    if (pc.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    } else {
      pendingCandidates.current.push(data.candidate);
    }
  }
}

async function flushPendingCandidates(
  pc: RTCPeerConnection,
  pendingCandidates: React.MutableRefObject<RTCIceCandidateInit[]>
) {
  for (const candidate of pendingCandidates.current) {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }
  pendingCandidates.current = [];
}
