"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessagesSquare } from "lucide-react";
import { ChatRoomProvider } from "@ably/chat/react";
import { useAvatar } from "@ably/chat-react-ui-kit";
import {
  ChatProviders,
  useChatRealtime,
} from "@/components/providers/ChatProviders";
import { useChatDock, type DockMode } from "@/components/chat/ChatDockProvider";
import { listMyThreads, markRead } from "@/components/chat/actions";
import ChatAvatar from "@/components/chat/ChatAvatar";
import Conversation from "@/components/chat/Conversation";
import type { ChatUser, ThreadSummary } from "@/lib/chat";
import { cn } from "@/lib/utils";

type Props = {
  me: ChatUser;
  mode: DockMode;
  onUnreadChange: (unread: number) => void;
};

// Loaded with next/dynamic by ChatDock the first time the dock opens.
export default function ChatPanel(props: Props) {
  return (
    <ChatProviders>
      <Panel {...props} />
    </ChatProviders>
  );
}

function Panel({ me, mode, onUnreadChange }: Props) {
  const realtime = useChatRealtime();
  const { request, clearRequest } = useChatDock();
  const { setUserAvatar, setRoomAvatar } = useAvatar();
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<{ room: string; text: string }>();
  const [error, setError] = useState<string | null>(null);
  // Rooms in the thread list as of the last load (null before the first).
  const knownRooms = useRef<Set<string> | null>(null);

  const refresh = useCallback(
    async ({ authorizeNew = true } = {}) => {
      const rows = await listMyThreads();
      const before = knownRooms.current;
      knownRooms.current = new Set(rows.map((row) => row.roomName));
      // A thread created since our token was issued isn't in its
      // capability yet; ask /api/ably-token for a fresh one.
      if (
        authorizeNew &&
        before &&
        rows.some((row) => !before.has(row.roomName))
      ) {
        await realtime?.auth.authorize();
      }
      // Room names are id pairs, so give the kit readable names.
      setUserAvatar(me.id, {
        displayName: me.name,
        src: me.image ?? undefined,
      });
      for (const row of rows) {
        const avatar = {
          displayName: row.other.name,
          src: row.other.image ?? undefined,
        };
        setRoomAvatar(row.roomName, avatar);
        setUserAvatar(row.other.id, avatar);
      }
      setThreads(rows);
      return rows;
    },
    [me, realtime, setRoomAvatar, setUserAvatar],
  );

  // First load, and again whenever the dock is reopened, to pick up threads
  // other people have started with us.
  const wasHidden = useRef(true);
  useEffect(() => {
    const opening = mode !== "hidden" && wasHidden.current;
    wasHidden.current = mode === "hidden";
    if (!opening) return;
    refresh().catch((err: unknown) => {
      console.error(err);
      setError("Couldn't load your conversations.");
    });
  }, [mode, refresh]);

  // The Chat button on a cat page asked for a particular conversation.
  useEffect(() => {
    if (!request || !realtime) return;
    let cancelled = false;
    (async () => {
      if (knownRooms.current && !knownRooms.current.has(request.roomName)) {
        await realtime.auth.authorize();
      }
      await refresh({ authorizeNew: false });
      if (cancelled) return;
      setActive(request.roomName);
      setPrefill(
        request.prefill
          ? { room: request.roomName, text: request.prefill }
          : undefined,
      );
      clearRequest();
    })().catch((err: unknown) => {
      console.error(err);
      setError("Couldn't open that conversation. Please try again.");
    });
    return () => {
      cancelled = true;
    };
  }, [request, realtime, refresh, clearRequest]);

  // Called by the open conversation while it's on screen.
  const onRead = useCallback((roomName: string) => {
    markRead(roomName).catch(() => {});
    setThreads((current) => {
      const thread = current?.find((t) => t.roomName === roomName);
      if (!current || !thread || thread.unread === 0) return current;
      const next = current.map((thread) =>
        thread.roomName === roomName ? { ...thread, unread: 0 } : thread,
      );
      return next;
    });
  }, []);

  // Keep the dock tab's badge in step with the thread list.
  useEffect(() => {
    if (threads) onUnreadChange(threads.reduce((sum, t) => sum + t.unread, 0));
  }, [threads, onUnreadChange]);

  const extended = mode === "extended";
  const activeThread = threads?.find((thread) => thread.roomName === active);

  if (error) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (!threads) {
    return (
      <p role="status" className="p-4 text-center text-muted-foreground">
        Loading conversations…
      </p>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1",
        extended && "sm:grid sm:grid-cols-[15rem_minmax(0,1fr)]",
      )}
    >
      {(extended || !activeThread) && (
        <ThreadList
          threads={threads}
          active={active}
          onSelect={setActive}
          className={cn(
            extended && "sm:border-r sm:border-border",
            activeThread && "max-sm:hidden",
          )}
        />
      )}
      {activeThread ? (
        <ChatRoomProvider
          key={activeThread.roomName}
          name={activeThread.roomName}
        >
          <Conversation
            thread={activeThread}
            prefill={
              prefill?.room === activeThread.roomName ? prefill.text : undefined
            }
            onBack={() => setActive(null)}
            visible={mode !== "hidden"}
            onRead={onRead}
            backOnPhonesOnly={extended}
          />
        </ChatRoomProvider>
      ) : (
        extended && (
          <p className="grid place-content-center p-6 text-center text-muted-foreground max-sm:hidden">
            Pick a conversation.
          </p>
        )
      )}
    </div>
  );
}

function ThreadList({
  threads,
  active,
  onSelect,
  className,
}: {
  threads: ThreadSummary[];
  active: string | null;
  onSelect: (roomName: string) => void;
  className?: string;
}) {
  if (threads.length === 0) {
    return (
      <div
        className={cn(
          "grid flex-1 place-content-center justify-items-center gap-3 p-6 text-center",
          className,
        )}
      >
        <MessagesSquare
          className="size-10 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="font-bold">No conversations yet</p>
        <p className="text-sm text-muted-foreground">
          Press Chat on a cat&apos;s page to message its parent.
        </p>
      </div>
    );
  }

  return (
    <nav
      aria-label="Conversations"
      className={cn("min-h-0 flex-1 overflow-y-auto", className)}
    >
      <ul>
        {threads.map((thread) => (
          <li key={thread.roomName}>
            <button
              type="button"
              onClick={() => onSelect(thread.roomName)}
              aria-current={thread.roomName === active ? "true" : undefined}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted aria-current:bg-active"
            >
              <ChatAvatar user={thread.other} />
              <span className="min-w-0 flex-1 truncate font-bold">
                {thread.other.name}
              </span>
              {thread.unread > 0 && (
                <span className="min-w-6 rounded-full bg-clay px-1.5 text-center text-xs leading-6 font-bold text-white">
                  <span className="sr-only">Unread messages: </span>
                  {thread.unread > 99 ? "99+" : thread.unread}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
