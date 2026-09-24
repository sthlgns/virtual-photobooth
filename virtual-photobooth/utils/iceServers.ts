export async function fetchIceServers(): Promise<RTCIceServer[]> {
  const stunFallback: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  try {
      const response = await fetch("/api/turn-credentials", { cache: "no-store" });
    if (!response.ok) {
      console.log("[ice] route responded", response.status);
      return stunFallback;
    }
    const data = await response.json();
    console.log("[ice] debug:", data.debug);
    return Array.isArray(data.iceServers) && data.iceServers.length > 0 ? data.iceServers : stunFallback;
  } catch (err) {
    console.log("[ice] fetch failed:", err);
    return stunFallback;
  }
}
