"use client";

import { useState, useTransition } from "react";
import { MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatDock } from "@/components/chat/ChatDockProvider";
import { openThread } from "@/app/(pages)/find_a_cat/[id]/chat-actions";

// Opens the chat dock on the conversation with this cat's parent, with the
// message box prefilled so the parent knows which cat it's about.
export default function ChatButton({
  catId,
  catName,
}: {
  catId: number;
  catName: string;
}) {
  const dock = useChatDock();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function start() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await openThread(catId);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        dock.openThread({
          roomName: result.roomName,
          other: result.other,
          prefill: `Hi! I'm interested in ${catName}: ${window.location.origin}/find_a_cat/${catId}`,
        });
      } catch (err) {
        console.error(err);
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        size="lg"
        variant="outline"
        disabled={pending}
        onClick={start}
        className="h-11 px-4 font-bold"
      >
        <MessagesSquare />
        {pending ? "Opening…" : "Chat"}
      </Button>
      {error && (
        <p role="alert" className="basis-full text-sm text-destructive">
          {error}
        </p>
      )}
    </>
  );
}
