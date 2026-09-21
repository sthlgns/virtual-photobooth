import { ROOM_CODE_LENGTH } from "@/lib/constants";

/** Generates a random numeric string, e.g. "04821". Leading zeros are allowed. */
export function generateRoomCode(): string {
  const max = 10 ** ROOM_CODE_LENGTH;
  const n = Math.floor(Math.random() * max);
  return n.toString().padStart(ROOM_CODE_LENGTH, "0");
}

export function isValidRoomCodeFormat(code: string): boolean {
  return new RegExp(`^\\d{${ROOM_CODE_LENGTH}}$`).test(code);
}
