import { Suspense } from "react";
import type { Metadata } from "next";
import { Albert_Sans, Bree_Serif, Figtree, Lora } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ChatDockProvider } from "@/components/chat/ChatDockProvider";
import ChatDockSlot from "@/components/chat/ChatDockSlot";

const loraHeading = Lora({ subsets: ["latin"], variable: "--font-heading" });

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });

const bree = Bree_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bree",
});
const albert = Albert_Sans({ subsets: ["latin"], variable: "--font-albert" });
const matcha = localFont({
  src: "./fonts/MatchaMint.otf",
  variable: "--font-matcha",
});

export const metadata: Metadata = {
  // The home page uses this; every other page sets its own title.
  title: "Home",
  description:
    "Bilai connects cat parents and adopters in Bangladesh. Find a friend, share a cat’s story, and start with a hello.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn(
        bree.variable,
        albert.variable,
        matcha.variable,
        "font-sans",
        figtree.variable,
        loraHeading.variable,
      )}
    >
      <body className="flex min-h-screen flex-col font-sans antialiased">
        {/* The chat dock is on every page. Its provider only holds UI state;
            the slot reads the session, so it streams in under Suspense and
            the static shell is unaffected. Ably itself loads on first open. */}
        <ChatDockProvider>
          {children}
          <Suspense fallback={null}>
            <ChatDockSlot />
          </Suspense>
        </ChatDockProvider>
      </body>
    </html>
  );
}
