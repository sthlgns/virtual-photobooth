import { NextResponse } from "next/server";

export async function GET() {
  const domain = process.env.METERED_DOMAIN;
  const secretKey = process.env.METERED_SECRET_KEY;

  if (!domain || !secretKey) {
    return NextResponse.json({ iceServers: null, debug: "env vars missing on server" });
  }

  try {
    const response = await fetch(
      `https://${domain}/api/v1/turn/credentials?apiKey=${secretKey}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      const bodyText = await response.text();
      return NextResponse.json({
        iceServers: null,
        debug: `Metered responded ${response.status}: ${bodyText.slice(0, 200)}`,
      });
    }

    const iceServers = await response.json();
    return NextResponse.json({ iceServers, debug: `got ${Array.isArray(iceServers) ? iceServers.length : "non-array"} servers` });
  } catch (err) {
    return NextResponse.json({ iceServers: null, debug: `fetch threw: ${err instanceof Error ? err.message : String(err)}` });
  }
}
