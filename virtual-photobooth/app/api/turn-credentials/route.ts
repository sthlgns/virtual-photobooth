import { NextResponse } from "next/server";

// Server-only: the secret key never reaches the browser. The client calls
// this route instead of Metered's API directly, so this is the one place
// the key is allowed to exist.
export async function GET() {
  const domain = process.env.METERED_DOMAIN;
  const secretKey = process.env.METERED_SECRET_KEY;

  if (!domain || !secretKey) {
    return NextResponse.json({ iceServers: null });
  }

  try {
    const response = await fetch(
      `https://${domain}/api/v1/turn/credentials?apiKey=${secretKey}`,
      { cache: "no-store" }
    );
    if (!response.ok) return NextResponse.json({ iceServers: null });
    const iceServers = await response.json();
    return NextResponse.json({ iceServers });
  } catch {
    return NextResponse.json({ iceServers: null });
  }
}
