/**
 * Asks our own server (app/api/turn-credentials) for TURN + STUN credentials,
 * rather than calling Metered directly — that way the secret key stays on
 * the server and never reaches the browser. Falls back to STUN-only if the
 * server route isn't configured or the request fails.
 */
export async function fetchIceServers(): Promise<RTCIceServer[]> {
  const stunFallback: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  try {
    const response = await fetch("/api/turn-credentials");
    if (!response.ok) return stunFallback;
    const data = await response.json();
    return Array.isArray(data.iceServers) && data.iceServers.length > 0 ? data.iceServers : stunFallback;
  } catch {
    return stunFallback;
  }
}
