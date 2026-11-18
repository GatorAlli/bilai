"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChatMessageEventType,
  type Message,
  type PaginatedResult,
} from "@ably/chat";
import { useMessages } from "@ably/chat/react";

// Live messages for the current <ChatRoomProvider> room, oldest first: history
// from before we subscribed, plus new messages, edits and deletes as they
// arrive. The UI kit has an equivalent (useMessageWindow) but doesn't export
// it. Conversations are between two people, so no windowing is needed.
export function useConversationMessages(pageSize = 50) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const page = useRef<PaginatedResult<Message> | null>(null);

  // Add or replace by serial. Message.with() keeps whichever version is newer.
  const merge = useCallback((incoming: Message[]) => {
    setMessages((current) => {
      const bySerial = new Map(current.map((m) => [m.serial, m]));
      for (const message of incoming) {
        const existing = bySerial.get(message.serial);
        bySerial.set(
          message.serial,
          existing ? existing.with(message) : message,
        );
      }
      // Ably serials sort chronologically as plain strings.
      return [...bySerial.values()].sort((a, b) =>
        a.serial < b.serial ? -1 : a.serial > b.serial ? 1 : 0,
      );
    });
  }, []);

  const { historyBeforeSubscribe, sendMessage, updateMessage, deleteMessage } =
    useMessages({
      listener: (event) => {
        if (event.type === ChatMessageEventType.Created) {
          merge([event.message]);
        } else {
          setMessages((current) =>
            current.map((m) =>
              m.serial === event.message.serial ? m.with(event) : m,
            ),
          );
        }
      },
    });

  // historyBeforeSubscribe appears once the subscription is live, and is
  // replaced after a discontinuity; reload the latest page each time.
  useEffect(() => {
    if (!historyBeforeSubscribe) return;
    let cancelled = false;
    historyBeforeSubscribe({ limit: pageSize })
      .then((result) => {
        if (cancelled) return;
        page.current = result;
        merge(result.items);
        setHasMore(result.hasNext());
        setLoading(false);
      })
      .catch((err: unknown) => {
        console.error("Failed to load chat history", err);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [historyBeforeSubscribe, merge, pageSize]);

  const loadMore = useCallback(async () => {
    const current = page.current;
    if (!current?.hasNext()) return;
    const next = await current.next();
    if (!next) return;
    page.current = next;
    merge(next.items);
    setHasMore(next.hasNext());
  }, [merge]);

  return {
    messages,
    loading,
    hasMore,
    loadMore,
    merge,
    sendMessage,
    updateMessage,
    deleteMessage,
  };
}
