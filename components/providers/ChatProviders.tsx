"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@ably/pubsub-device";
import { createChatClient, type ChatClient } from "@ably/chat";
import { ChatClientProvider } from "@ably/chat/react";
import {
  ThemeProvider,
  AvatarProvider,
  ChatSettingsProvider,
} from "@ably/chat-react-ui-kit";
import "@/components/chat/ably-chat-kit.css";

type Realtime = ReturnType<typeof createClient>;

const RealtimeContext = createContext<Realtime | null>(null);

// The underlying Ably client, for auth.authorize() after a new chat thread is
// created (the token's capability has to be re-issued to include the room).
export function useChatRealtime() {
  return useContext(RealtimeContext);
}

// Mounted only inside the chat dock's panel (components/chat/ChatPanel.tsx),
// which is itself loaded with next/dynamic the first time the dock is opened.
// So ordinary page views never open a realtime connection or load the UI
// kit's CSS.
//
// clientId is intentionally left unset here: /api/ably-token signs the token
// request with the session user's id, and the resolved token carries it.
export function ChatProviders({ children }: { children: React.ReactNode }) {
  const [clients, setClients] = useState<{
    realtime: Realtime;
    chat: ChatClient;
  } | null>(null);

  useEffect(() => {
    const realtime = createClient({ authUrl: "/api/ably-token" });
    const chat = createChatClient(realtime);
    // One-time creation of an external client on mount (empty deps below),
    // not a per-render state sync - safe despite the lint rule's general advice.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClients({ realtime, chat });

    return () => {
      void chat.dispose().finally(() => realtime.close());
    };
  }, []);

  if (!clients) {
    return (
      <p role="status" className="p-4 text-center text-muted-foreground">
        Connecting to chat…
      </p>
    );
  }

  return (
    // The kit's ThemeProvider toggles a `dark` class on <html>, which would
    // also switch the rest of the site. Pin it to light and never read the
    // system or stored preference.
    <ThemeProvider
      options={{
        persist: false,
        detectSystemTheme: false,
        defaultTheme: "light",
      }}
    >
      <AvatarProvider>
        <ChatSettingsProvider
          initialGlobalSettings={{
            allowMessageUpdatesOwn: true,
            allowMessageDeletesOwn: true,
            allowMessageUpdatesAny: false,
            allowMessageDeletesAny: false,
            allowMessageReactions: false,
          }}
        >
          <RealtimeContext.Provider value={clients.realtime}>
            <ChatClientProvider client={clients.chat}>
              {children}
            </ChatClientProvider>
          </RealtimeContext.Provider>
        </ChatSettingsProvider>
      </AvatarProvider>
    </ThemeProvider>
  );
}
