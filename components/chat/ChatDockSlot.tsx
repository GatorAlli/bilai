import { getSession } from "@/lib/auth";
import ChatDock from "@/components/chat/ChatDock";

// Server half of the chat dock, rendered by the root layout inside its own
// <Suspense> (it reads the session, so it streams in after the static shell).
export default async function ChatDockSlot() {
  const session = await getSession();
  if (!session?.user) return <ChatDock signedIn={false} />;

  const { id, name, image } = session.user;
  return <ChatDock signedIn me={{ id, name, image: image ?? null }} />;
}
