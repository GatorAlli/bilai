"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ChatUser } from "@/lib/chat";

// hidden: just the tab. open: compact panel. extended: wider, with the
// conversation list beside the conversation. Phones show open/extended as a
// full-screen sheet.
export type DockMode = "hidden" | "open" | "extended";

// A request from elsewhere on the page (the Chat button on a cat page) to
// open a particular conversation, optionally with the composer prefilled.
export type OpenRequest = {
  roomName: string;
  other: ChatUser;
  prefill?: string;
};

type DockContext = {
  mode: DockMode;
  setMode: (mode: DockMode) => void;
  request: OpenRequest | null;
  openThread: (request: OpenRequest) => void;
  clearRequest: () => void;
};

const Ctx = createContext<DockContext | null>(null);

// Wraps every page (app/layout.tsx) so any component can open the chat dock.
// Holds only UI state: nothing here talks to Ably.
export function ChatDockProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<DockMode>("hidden");
  const [request, setRequest] = useState<OpenRequest | null>(null);

  const openThread = useCallback((next: OpenRequest) => {
    setRequest(next);
    setMode((current) => (current === "hidden" ? "open" : current));
  }, []);
  const clearRequest = useCallback(() => setRequest(null), []);

  const value = useMemo(
    () => ({ mode, setMode, request, openThread, clearRequest }),
    [mode, request, openThread, clearRequest],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChatDock() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useChatDock needs <ChatDockProvider>");
  return value;
}
