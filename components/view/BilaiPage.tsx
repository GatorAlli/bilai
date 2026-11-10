import type { ComponentProps, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import { ArrowUp } from "lucide-react";
import Navbar from "./navbar/Navbar";
import "./bilai.css";

const fraunces = localFont({
  src: "../../app/fonts/Fraunces.woff2",
  weight: "500 800",
  display: "swap",
  variable: "--bilai-display",
});

export default function BilaiPage({
  currentPage,
  mainClassName,
  children,
}: {
  currentPage: ComponentProps<typeof Navbar>["currentPage"];
  mainClassName?: string;
  children: ReactNode;
}) {
  const isHome = currentPage === "home";
  const top = isHome ? "home" : "page-top";

  return (
    <div
      id={top}
      className={`bilai-theme bilai-site ${fraunces.variable}${isHome ? " bilai-home-page" : ""}`}
    >
      <a className="bilai-skip" href="#main-content">Skip to content</a>
      <Navbar currentPage={currentPage} />
      <main id="main-content" className={mainClassName} tabIndex={-1}>
        {children}
      </main>
      <footer className="bilai-footer" data-bilai-dark>
        <div className="bilai-frame bilai-footer-row">
          <Link href="/" className="bilai-nav-brand" aria-label="Bilai home">
            <Image src="/logo.png" width={40} height={40} alt="" />
            <span>bilai.</span>
          </Link>
          <a href={`#${top}`} className="bilai-footer-top">
            Back to top
            <ArrowUp size={18} aria-hidden="true" />
          </a>
        </div>
      </footer>
    </div>
  );
}
