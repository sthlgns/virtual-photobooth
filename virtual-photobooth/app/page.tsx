import { Logo } from "@/components/landing/Logo";
import { CreateRoomButton } from "@/components/landing/CreateRoomButton";
import { JoinRoomModal } from "@/components/landing/JoinRoomModal";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-12 px-6 py-16">
      <Logo />
      <div className="flex flex-col items-center gap-4">
        <CreateRoomButton />
        <JoinRoomModal />
      </div>
    </main>
  );
}
