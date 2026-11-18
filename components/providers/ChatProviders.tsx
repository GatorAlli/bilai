"use client";

import { useEffect, useState } from "react";
import { createClient } from "@ably/pubsub-device";
import { createChatClient, type ChatClient } from "@ably/chat";
import { ChatClientProvider } from "@ably/chat/react";
import {
  ThemeProvider,
  AvatarProvider,
  ChatSettingsProvider,
} from "@ably/chat-react-ui-kit";
import "@ably/chat-react-ui-kit/dist/style.css";

// Wrap a chat page/route with this component (not the root layout): it opens
// a realtime connection on mount, which would be wasted on every page view
// for visitors who never touch chat. The page using it should already redirect
// signed-out visitors before rendering, the same way app/(pages)/profile/page.tsx
// does with getSession() - the token route below rejects them anyway.
//
// clientId is intentionally left unset here: /api/ably-token signs the token
// request with the session user's id, and the resolved token carries it.
export function ChatProviders({ children }: { children: React.ReactNode }) {
  const [chatClient, setChatClient] = useState<ChatClient | null>(null);

  useEffect(() => {
    const pubsubClient = createClient({ authUrl: "/api/ably-token" });
    const client = createChatClient(pubsubClient);
    // One-time creation of an external client on mount (empty deps below),
    // not a per-render state sync - safe despite the lint rule's general advice.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChatClient(client);

    return () => {
      void client.dispose();
    };
  }, []);

  if (!chatClient) {
    return (
      <p role="status" className="py-8 text-center text-muted-foreground">
        Connecting to chat…
      </p>
    );
  }

  return (
    <ThemeProvider options={{ persist: true, defaultTheme: "light" }}>
      <AvatarProvider>
        <ChatSettingsProvider>
          <ChatClientProvider client={chatClient}>
            {children}
          </ChatClientProvider>
        </ChatSettingsProvider>
      </AvatarProvider>
    </ThemeProvider>
  );
}
