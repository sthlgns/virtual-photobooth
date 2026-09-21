export const ROOM_CODE_LENGTH = 5;
export const TOTAL_PHOTOS = 4;
export const COUNTDOWN_SECONDS = 4;
export const PAUSE_BETWEEN_SHOTS_MS = 1000;
export const ROOM_INACTIVITY_EXPIRY_MINUTES = 20;

// localStorage key used to persist which slot (host/guest) this browser
// occupies in a given room, so a refresh doesn't create a duplicate participant.
export const PARTICIPANT_STORAGE_PREFIX = "vpb:participant:";

export const SUPABASE_REALTIME_CHANNEL_PREFIX = "room:";

export const SOUND_SHUTTER_SRC = "/sounds/shutter.mp3";