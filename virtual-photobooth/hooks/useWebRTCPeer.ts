"use client";

import { useEffect, useRef, useState } from "react";
import type { ParticipantSlot, RealtimeEvent, WebRTCSignalData } from "@/types";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

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
}

/**
 * Sets up a single RTCPeerConnection between the two room participants so
 * each browser can show a live preview of the other's camera. The "host"
 * always initiates the offer once both sides are present with a stream.
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

  // Tear down and recreate the connection whenever the partner (re)joins.
  useEffect(() => {
    if (!localStream || !mySlot || !partnerConnected) return;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    pendingCandidates.current = [];
    processedCountRef.current = events.length;

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    // Just capture the stream here — the <video> element that will play it
    // may not exist in the DOM yet (it's rendered conditionally), so binding
    // srcObject happens in the effect below once both are ready.
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

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        setRemoteStream(null);
        setRemoteStreamActive(false);
      }
    };

    // Deterministic initiator: the host always makes the offer.
    if (mySlot === "host") {
      pc.onnegotiationneeded = async () => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        void sendEvent({ type: "webrtc_signal", from: mySlot, data: { kind: "offer", sdp: offer } });
      };
    }

    return () => {
      pc.close();
      pcRef.current = null;
      setRemoteStream(null);
      setRemoteStreamActive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream, mySlot, partnerConnected]);

  // Bind the remote stream to the <video> element once both exist. The video
  // tag is always mounted (see CameraPreview) specifically so this ref is
  // never null by the time a stream shows up.
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      setRemoteStreamActive(true);
    }
  }, [remoteStream]);

  // Handle incoming signaling messages relayed via Realtime broadcast.
  // Iterates every event this hook hasn't seen yet, in order, so a burst of
  // trickling ICE candidates arriving close together can't get skipped.
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

  return { remoteVideoRef, remoteStreamActive };
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
