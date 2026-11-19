"use client";

import { useCallback, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import type { Message } from "@ably/chat";
import { useChatClient, useTyping } from "@ably/chat/react";
import {
  ChatMessageList,
  ChatWindowFooter,
  ChatWindowHeader,
} from "@ably/chat-react-ui-kit";
import ChatAvatar from "@/components/chat/ChatAvatar";
import Composer from "@/components/chat/Composer";
import { useConversationMessages } from "@/components/chat/useConversationMessages";
import type { ThreadSummary } from "@/lib/chat";
import { cn } from "@/lib/utils";

// One conversation, built from the UI kit's pieces rather than its
// <ChatWindow>: ChatWindow's labels and placeholder show the raw room name
// ("dm:<id>:<id>") and its input can't be prefilled. Edit/delete are wired the
// same way ChatWindow does it, on top of useConversationMessages. Must be inside <ChatRoomProvider>.
//
// Typing indicator is also hand-rolled: the kit's own <TypingIndicators>
// (wired up via ChatMessageList's enableTypingIndicators prop) renders the
// raw Ably clientId, which is this app's user id, not a name. A DM only ever
// has one other party, so we just show/hide "<name> is typing" ourselves.
export default function Conversation({
  thread,
  prefill,
  onBack,
  backOnPhonesOnly,
  visible,
  onRead,
}: {
  thread: ThreadSummary;
  prefill?: string;
  onBack: () => void;
  backOnPhonesOnly: boolean;
  visible: boolean;
  onRead: (roomName: string) => void;
}) {
  const {
    messages,
    loading,
    hasMore,
    loadMore,
    merge,
    sendMessage,
    updateMessage,
    deleteMessage,
  } = useConversationMessages();

  // Mark read when the conversation is on screen: on open, and whenever a
  // message arrives while it's showing.
  const latest = messages.at(-1)?.serial;
  useEffect(() => {
    if (visible) onRead(thread.roomName);
  }, [visible, latest, thread.roomName, onRead]);

  const replace = useCallback((message: Message) => merge([message]), [merge]);

  const onEdit = useCallback(
    (message: Message, text: string) => {
      updateMessage(message.serial, {
        text,
        metadata: message.metadata,
        headers: message.headers,
      })
        .then(replace)
        .catch((err: unknown) => console.error("Failed to edit message", err));
    },
    [updateMessage, replace],
  );

  const onDelete = useCallback(
    (message: Message) => {
      deleteMessage(message.serial, { description: "deleted by user" })
        .then(replace)
        .catch((err: unknown) =>
          console.error("Failed to delete message", err),
        );
    },
    [deleteMessage, replace],
  );

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      aria-label={`Conversation with ${thread.other.name}`}
      role="region"
    >
      <ChatWindowHeader aria-label={`Conversation with ${thread.other.name}`}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to conversations"
            className={cn(
              "-ml-2 inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted",
              backOnPhonesOnly && "sm:hidden",
            )}
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </button>
          <ChatAvatar user={thread.other} className="size-8" />
          <span className="truncate font-bold">{thread.other.name}</span>
        </div>
      </ChatWindowHeader>
      <ChatMessageList
        className="min-h-0 flex-1"
        messages={messages}
        isLoading={loading}
        hasMoreHistory={hasMore}
        onLoadMoreHistory={() => void loadMore()}
        onEdit={onEdit}
        onDelete={onDelete}
      />
      <TypingStatus otherName={thread.other.name} />
      <ChatWindowFooter>
        <Composer
          initialText={prefill}
          otherName={thread.other.name}
          sendMessage={sendMessage}
          onSent={replace}
        />
      </ChatWindowFooter>
    </div>
  );
}

// currentTypers can include our own clientId while we're typing (echoed
// back from the room), so filter it out before checking for the other party.
function TypingStatus({ otherName }: { otherName: string }) {
  const { clientId } = useChatClient();
  const { currentTypers } = useTyping();
  const otherIsTyping = currentTypers.some(
    (typer) => typer.clientId !== clientId,
  );

  if (!otherIsTyping) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 px-4 pb-1 text-sm text-muted-foreground"
    >
      <span className="flex gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="size-1.5 animate-bounce rounded-full bg-current"
            style={{ animationDelay: `${dot * 0.15}s` }}
          />
        ))}
      </span>
      <span>{otherName} is typing</span>
    </div>
  );
}
