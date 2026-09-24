"use client";

import { useEffect, useRef, useState } from "react";
import type { ParticipantSlot, RealtimeEvent, WebRTCSignalData } from "@/types";
import { fetchIceServers } from "@/utils/iceServers";

const DISCONNECT_GRACE_MS = 6000;
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

    let cancelled = false;
    let pc: RTCPeerConnection | null = null;
    let disconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let initialConnectTimer: ReturnType<typeof setTimeout> | null = null;

    processedCountRef.current = events.length;
    setReconnecting(false);

    (async () => {
      const iceServers = await fetchIceServers();
      console.log("[webrtc] ICE servers:", iceServers.length, iceServers.map((s) => s.urls));
      if (cancelled) return;

      pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;
      pendingCandidates.current = [];

      localStream.getTracks().forEach((track) => pc!.addTrack(track, localStream));

      pc.ontrack = (event) => {
              console.log("[webrtc] ontrack fired, streams:", event.streams.length);
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

      pc.onconnectionstatechange = () => {
        if (!pc) return;
         console.log("[webrtc] connection state:", pc.connectionState);
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

      initialConnectTimer = setTimeout(() => {
        if (pc && pc.connectionState !== "connected") {
          setRemoteStream(null);
          setRemoteStreamActive(false);
          setReconnectTick((n) => n + 1);
        }
      }, INITIAL_CONNECT_TIMEOUT_MS);

      if (mySlot === "host") {
        pc.onnegotiationneeded = async () => {
          if (!pc) return;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          void sendEvent({ type: "webrtc_signal", from: mySlot, data: { kind: "offer", sdp: offer } });
        };
      }
    })();

    return () => {
      cancelled = true;
      if (disconnectTimer) clearTimeout(disconnectTimer);
      if (initialConnectTimer) clearTimeout(initialConnectTimer);
      pc?.close();
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
