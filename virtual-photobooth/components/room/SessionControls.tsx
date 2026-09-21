"use client";

import { Button } from "@/components/ui/Button";
import { COUNTDOWN_SECONDS, TOTAL_PHOTOS } from "@/lib/constants";

interface SessionControlsProps {
  onStart: () => void;
  disabled: boolean;
}

export function SessionControls({ onStart, disabled }: SessionControlsProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Button variant="primary" className="w-56" onClick={onStart} disabled={disabled}>
        Start Session
      </Button>
      <p className="text-xs text-muted">
        {TOTAL_PHOTOS} photos · {COUNTDOWN_SECONDS}-second countdown each
      </p>
    </div>
  );
}