import type { Metadata } from "next";
import { Albert_Sans, Bree_Serif } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

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
      className={`${bree.variable} ${albert.variable} ${matcha.variable}`}
    >
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
