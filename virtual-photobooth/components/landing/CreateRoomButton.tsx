"use client";

import { Button } from "@/components/ui/Button";
import { useCreateRoom } from "@/hooks/useRoom";

export function CreateRoomButton() {
  const { create, creating, error } = useCreateRoom();

  return (
    <div className="flex flex-col items-center gap-2">
      <Button variant="primary" className="w-64" onClick={create} isLoading={creating}>
        {creating ? "Creating room…" : "Create Room"}
      </Button>
      {error ? <p className="text-sm text-curtain">{error}</p> : null}
    </div>
  );
}
