import { SOUND_SHUTTER_SRC } from "@/lib/constants";

let shutterAudio: HTMLAudioElement | null = null;

export function playShutterSound(): void {
  if (typeof window === "undefined") return;

  try {
    if (!shutterAudio) {
      shutterAudio = new Audio(SOUND_SHUTTER_SRC);
      shutterAudio.volume = 0.6;
    }
    // Rewind so rapid repeated calls (3 shots) always play from the start.
    shutterAudio.currentTime = 0;
    void shutterAudio.play().catch(() => {
      // Autoplay can be blocked before the first user gesture; fail silently.
    });
  } catch {
    // Audio isn't critical to the experience — never let it break a capture.
  }
}
