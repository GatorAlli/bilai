import type { Metadata } from "next";
import { Albert_Sans, Bree_Serif, Figtree, Lora } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";

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
  title: "bilai. | A little friend. A whole lot of love.",
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
        {children}
      </body>
    </html>
  );
}
