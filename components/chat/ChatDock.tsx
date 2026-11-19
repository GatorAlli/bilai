"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessagesSquare, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useChatDock } from "@/components/chat/ChatDockProvider";
import { getMyUnreadCount } from "@/components/chat/actions";
import type { ChatUser } from "@/lib/chat";
import { cn } from "@/lib/utils";

// The Ably SDK, the UI kit and its CSS load only the first time the dock is
// opened, so ordinary page views never open a realtime connection.
const ChatPanel = dynamic(() => import("@/components/chat/ChatPanel"), {
  ssr: false,
  loading: () => (
    <p role="status" className="p-4 text-center text-muted-foreground">
      Connecting to chat…
    </p>
  ),
});

type Props =
  | { signedIn: false; me?: undefined; initialUnread?: undefined }
  | { signedIn: true; me: ChatUser; initialUnread?: number };

const iconButton =
  "inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

// The dock lives in the root layout, outside BilaiPage, so it opts into the
// site palette itself with `bilai-theme`.
export default function ChatDock({ signedIn, me, initialUnread = 0 }: Props) {
  const { mode, setMode } = useChatDock();
  const [unread, setUnread] = useState(initialUnread);
  const [panelLoaded, setPanelLoaded] = useState(false);
  const tabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);
  const isOpen = mode !== "hidden";

  // Keep the panel (and its Ably connection) mounted once it has been opened,
  // so hiding and reopening the dock doesn't reconnect.
  if (isOpen && !panelLoaded) setPanelLoaded(true);

  // The root layout (and so ChatDockSlot) doesn't re-render on client-side
  // navigation, so refresh the badge when the route changes or the dock is
  // hidden. Skipped on first render: the server already sent the count.
  const pathname = usePathname();
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!signedIn || isOpen) return;
    let cancelled = false;
    getMyUnreadCount()
      .then((count) => {
        if (!cancelled) setUnread(count);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname, signedIn, isOpen]);

  // Move focus into the dock when it opens and back to the tab when it hides.
  useEffect(() => {
    if (isOpen && !wasOpen.current) panelRef.current?.focus();
    if (!isOpen && wasOpen.current) tabRef.current?.focus();
    wasOpen.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // Leave Escape to the UI kit's own modal dialogs (e.g. "Delete
      // message?") and its inline message editor, which use it to cancel.
      const target = event.target as HTMLElement | null;
      const editing =
        target?.matches("textarea, input") && target.id !== "chat-composer";
      const kitDialogOpen = document.querySelector(
        '[role="dialog"][aria-modal="true"]',
      );
      if (editing || kitDialogOpen) return;
      setMode("hidden");
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, setMode]);

  return (
    <>
      <button
        ref={tabRef}
        type="button"
        hidden={isOpen}
        onClick={() => setMode("open")}
        aria-label={unread > 0 ? `Messages, ${unread} unread` : "Messages"}
        className="bilai-theme fixed right-4 bottom-4 z-50 inline-flex size-14 items-center justify-center gap-2 rounded-full bg-action font-bold text-on-dark shadow-lg hover:bg-action/90 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus sm:h-12 sm:w-auto sm:px-5"
      >
        <MessagesSquare className="size-5" aria-hidden="true" />
        <span className="max-sm:sr-only">Messages</span>
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 min-w-6 rounded-full bg-clay px-1.5 text-center text-xs leading-6 font-bold text-white"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      <section
        ref={panelRef}
        tabIndex={-1}
        hidden={!isOpen}
        role="dialog"
        aria-modal="false"
        aria-labelledby="chat-dock-title"
        className={cn(
          "bilai-theme fixed z-50 flex flex-col overflow-hidden bg-card text-card-foreground shadow-2xl outline-none",
          "max-sm:inset-0", // phones: full-screen sheet
          "sm:right-4 sm:bottom-4 sm:rounded-xl sm:border sm:border-border",
          mode === "extended"
            ? "sm:h-[min(40rem,calc(100dvh-2rem))] sm:w-[min(52rem,calc(100vw-2rem))]"
            : "sm:h-[min(34rem,calc(100dvh-2rem))] sm:w-[24rem]",
        )}
      >
        <header className="flex shrink-0 items-center gap-1 border-b border-border py-1.5 pr-1.5 pl-4">
          <h2 id="chat-dock-title" className="flex-1 font-bold">
            Messages
          </h2>
          <button
            type="button"
            onClick={() => setMode("hidden")}
            aria-label="Hide chat"
            className={iconButton}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          {!signedIn ? (
            <div className="grid flex-1 place-content-center justify-items-center gap-4 p-6 text-center">
              <MessagesSquare
                className="size-10 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="font-bold">Sign in to check your messages</p>
              <Link
                href="/auth"
                onClick={() => setMode("hidden")}
                className={buttonVariants({
                  size: "lg",
                  className: "h-11 px-5 font-bold",
                })}
              >
                Sign in
              </Link>
            </div>
          ) : (
            panelLoaded && (
              <ChatPanel me={me} mode={mode} onUnreadChange={setUnread} />
            )
          )}
        </div>
      </section>
    </>
  );
}
