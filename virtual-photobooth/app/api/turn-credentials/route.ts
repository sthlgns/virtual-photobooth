import { NextResponse } from "next/server";

// Serves a pre-generated TURN credential directly, rather than calling
// Metered's live API each time — simpler and removes a network dependency,
// and this credential doesn't need to rotate for a personal-use app.
export async function GET() {
  const raw = process.env.METERED_ICE_SERVERS_JSON;

  if (!raw) {
    return NextResponse.json({ iceServers: null, debug: "METERED_ICE_SERVERS_JSON not set" });
  }

  try {
    const iceServers = JSON.parse(raw);
    return NextResponse.json({
      iceServers,
      debug: `loaded ${Array.isArray(iceServers) ? iceServers.length : "non-array"} servers`,
    });
  } catch (err) {
    return NextResponse.json({
      iceServers: null,
      debug: `JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}
