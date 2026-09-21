# Virtual Photobooth

A minimalist virtual photobooth for exactly two people. Create a room, share
the 5-digit code, and capture a synchronized 3-photo strip together — no
accounts, no downloads besides the final image.

## Stack

- **Next.js 14 (App Router) + TypeScript**
- **Tailwind CSS** for styling
- **Supabase** — Postgres for room state, Realtime (broadcast + presence) for sync and WebRTC signaling, Storage for an optional cloud copy of finished strips
- **WebRTC (`RTCPeerConnection`)** for the live partner camera preview — Supabase Realtime is used purely as the signaling channel to exchange offer/answer/ICE
- **Canvas API** to composite the final strip
- **Framer Motion** for animation

## How the sync works

1. Whichever participant clicks **Start Session** picks `startedAt = now + 900ms`
   and broadcasts it over the room's Realtime channel.
2. Both browsers independently compute the countdown phase, shot index, and
   capture instant from that single shared timestamp — no further messages
   are needed to stay in lockstep, only that both system clocks are roughly
   in sync (true for the vast majority of devices).
3. Because each browser already has a **live WebRTC stream of the other
   person's camera**, each side captures *both* photos (its own camera +
   the partner's incoming video) locally at the synchronized instant. No
   photo data has to be transferred over the network to assemble the strip.
4. The finished strip is generated locally on both sides and is optionally
   uploaded to Supabase Storage as a backup copy (failure here never blocks
   downloading the strip, which always works from the in-memory canvas data
   URL).

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create a Supabase project**, then run `supabase/schema.sql` in the SQL
   editor. This creates the `rooms` table, RLS policies, and a public
   `strips` storage bucket.

3. **Enable Realtime** on the project (Realtime is on by default for new
   Supabase projects; broadcast/presence don't require enabling replication
   on any table).

4. **Copy env vars**
   ```bash
   cp .env.local.example .env.local
   ```
   Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

5. **Add a shutter sound (optional)**
   Drop an MP3 at `public/sounds/shutter.mp3`. If it's missing, capture
   still works — the app just fails silently on audio playback.

6. **Run locally**
   ```bash
   npm run dev
   ```

## Deploying to Vercel

- Import the repo in Vercel, add the two `NEXT_PUBLIC_SUPABASE_*` env vars
  in Project Settings → Environment Variables, and deploy.
- The app is optimized for desktop browsers (per the brief) but is
  responsive down to smaller viewports.

## Notes & limitations

- **TURN server**: the app ships with public Google STUN servers only. On
  networks with strict symmetric NATs/firewalls, the direct WebRTC peer
  connection for the partner preview may fail to establish. For production
  use behind corporate networks, add a TURN server (e.g. via Twilio or
  Cloudflare Calls) to the `ICE_SERVERS` array in `hooks/useWebRTCPeer.ts`.
- **Room security**: since the app is intentionally account-free, access to
  a room is gated only by knowledge of its 5-digit code (RLS policies allow
  the anon key broad read/write on `rooms`). This is an acceptable tradeoff
  for a disposable, two-person session but isn't meant for sensitive data.
- **Inactive room cleanup**: `expire_inactive_rooms()` in `schema.sql`
  deletes empty rooms after 20 minutes. Schedule it with `pg_cron`, or call
  it from a small Vercel Cron Job hitting a `/api/cleanup` route if you'd
  rather not enable the Postgres extension.

## Folder structure

```
app/                 routes (landing page, /room/[code])
components/
  landing/           logo, create/join room UI
  room/               camera preview, countdown, strip, controls
  ui/                 shared primitives (Button, GlassPanel, Spinner, Toast)
hooks/                useRoom, useCamera, useRealtimeRoom, useWebRTCPeer, usePhotoSession
services/             roomService, realtimeService, storageService (all Supabase I/O)
lib/                  supabase client, constants
utils/                room code, canvas strip compositing, frame capture, sound
types/                shared TypeScript types
supabase/schema.sql   database schema + RLS + storage bucket
```
