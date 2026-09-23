/**
 * Fetches TURN + STUN server credentials from Metered's free tier. TURN
 * relays video through a middle server when two devices can't reach each
 * other directly (common across different countries/ISPs/NATs) — STUN
 * alone only handles simpler, same-network-ish cases.
 * Falls back to STUN-only if the credentials aren't configured or the
 * request fails, so the app still works for same-network testing either way.
 */
export async function fetchIceServers(): Promise<RTCIceServer[]> {
  const appName = process.env.NEXT_PUBLIC_METERED_APP_NAME;
  const apiKey = process.env.NEXT_PUBLIC_METERED_API_KEY;

  const stunFallback: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  if (!appName || !apiKey) return stunFallback;

  try {
    const response = await fetch(
      `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`
    );
    if (!response.ok) return stunFallback;
    const servers = await response.json();
    return Array.isArray(servers) && servers.length > 0 ? servers : stunFallback;
  } catch {
    return stunFallback;
  }
}
