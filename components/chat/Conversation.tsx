"use client";

import { useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import type { Message } from "@ably/chat";
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
export default function Conversation({
  thread,
  prefill,
  onBack,
  backOnPhonesOnly,
}: {
  thread: ThreadSummary;
  prefill?: string;
  onBack: () => void;
  backOnPhonesOnly: boolean;
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
        enableTypingIndicators
      />
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
