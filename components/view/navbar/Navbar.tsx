"use client";

import Image from "next/image";
import Link from "next/link";
import { LogIn, Menu, User, X } from "lucide-react";
import { Suspense, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { loginUrl } from "@/lib/auth-redirect";
import PawIcon from "../PawIcon";

// "profile" is a cat's page; "account" is the signed-in person's own page;
// "none" highlights no tab (the 404 page).
type Page = "home" | "find" | "profile" | "account" | "login" | "list" | "none";

const navFocus =
  "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus";

// Shared by the three controls on the right. No display or border colour here:
// each use sets its own, so the two never race for the same property.
const navControl = `min-h-10 items-center justify-center gap-2 rounded-[.65rem] border text-sm font-bold leading-[1.3] transition-colors duration-160 motion-reduce:transition-none max-nav:min-h-11 ${navFocus}`;

const navButton = `inline-flex ${navControl} border-brand-ink px-3 py-[.45rem]`;

const navTab = `group flex min-h-10 items-center justify-center rounded-[.65rem] px-3 text-sm font-[650] whitespace-nowrap transition-colors duration-160 motion-reduce:transition-none hover:text-moss focus-visible:text-moss aria-[current]:text-moss hover:text-shadow-[var(--bilai-label-shadow)] focus-visible:text-shadow-[var(--bilai-label-shadow)] aria-[current]:text-shadow-[var(--bilai-label-shadow)] max-nav:min-h-11 max-nav:justify-start max-nav:aria-[current]:bg-active forced-colors:aria-[current]:outline-1 forced-colors:aria-[current]:outline-[color:Highlight] forced-colors:aria-[current]:-outline-offset-1 ${navFocus}`;

// The rule that wipes in under the tab label while the tab is hovered.
const navLabel =
  "relative after:absolute after:inset-x-0 after:-bottom-[.15rem] after:h-px after:scale-x-0 after:bg-current after:transition-transform after:duration-300 after:ease-[cubic-bezier(.77,0,.175,1)] after:content-[''] group-hover:after:scale-x-100 group-focus-visible:after:scale-x-100 motion-reduce:after:transition-none forced-colors:after:bg-[color:LinkText] forced-colors:after:[forced-color-adjust:none]";

function LoginLink({
  href,
  currentPage,
  onClick,
}: {
  href: string;
  currentPage: Page;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      className={`${navButton} bg-brand-ink text-on-dark hover:bg-brand-ink-hover active:bg-brand-ink-hover`}
      aria-current={currentPage === "login" ? "page" : undefined}
      onClick={onClick}
    >
      <LogIn size={16} aria-hidden="true" />
      Login
    </Link>
  );
}

// Login brings people back to the page they were on.
function ReturningLoginLink(
  props: Omit<Parameters<typeof LoginLink>[0], "href">,
) {
  const pathname = usePathname();
  return <LoginLink {...props} href={loginUrl(pathname)} />;
}

export default function Navbar({ currentPage }: { currentPage: Page }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: session, isPending } = authClient.useSession();
  const userName = session?.user.name;
  const menuId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const desktop = window.matchMedia("(width > 54rem)");
    const closeMenu = () => setMenuOpen(false);

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !headerRef.current?.contains(event.target)
      ) {
        closeMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
        menuButtonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    desktop.addEventListener("change", closeMenu);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      desktop.removeEventListener("change", closeMenu);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);
  const findCurrent = currentPage === "find" || currentPage === "profile";
  const MenuIcon = menuOpen ? X : Menu;

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-5 border-b border-line bg-paper text-brand-ink scheme-light print:hidden"
    >
      <div className="relative frame flex min-h-14 items-center justify-between">
        <Link
          href="/"
          className={`inline-flex min-h-11 items-center gap-2.5 font-brand text-[1.625rem] leading-none ${navFocus}`}
          aria-label="Bilai home"
          onClick={closeMenu}
        >
          <Image
            src="/logo.png"
            alt=""
            width={40}
            height={40}
            loading="eager"
            className="size-10 mix-blend-multiply"
          />
          <span>bilai.</span>
        </Link>
        <button
          ref={menuButtonRef}
          type="button"
          className={`${navControl} hidden w-11 border-transparent hover:bg-active active:bg-active max-nav:inline-flex`}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-controls={menuId}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MenuIcon size={20} aria-hidden="true" />
        </button>
        <nav
          id={menuId}
          aria-label="Main navigation"
          className="flex items-center max-nav:absolute max-nav:inset-x-0 max-nav:top-full max-nav:flex-col max-nav:items-stretch max-nav:gap-2 max-nav:rounded-[.65rem] max-nav:border max-nav:border-line max-nav:bg-on-dark max-nav:p-3 max-nav:data-[open=false]:hidden"
          data-open={menuOpen}
        >
          <div className="absolute inset-y-0 left-1/2 grid -translate-x-1/2 grid-cols-2 gap-3 max-nav:static max-nav:translate-none max-nav:grid-cols-1 max-nav:gap-1">
            <Link
              href="/"
              className={navTab}
              aria-current={currentPage === "home" ? "page" : undefined}
              onClick={closeMenu}
            >
              <span className={navLabel}>Homepage</span>
            </Link>
            <Link
              href="/find_a_cat"
              className={navTab}
              aria-current={
                findCurrent
                  ? currentPage === "find"
                    ? "page"
                    : "location"
                  : undefined
              }
              onClick={closeMenu}
            >
              <span className={navLabel}>Find a cat</span>
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 max-nav:px-1">
            {userName ? (
              <Link
                href="/profile"
                className={`${navButton} bg-brand-ink text-on-dark hover:bg-brand-ink-hover active:bg-brand-ink-hover aria-[current]:bg-brand-ink-hover`}
                aria-current={currentPage === "account" ? "page" : undefined}
                aria-label={`Your profile, ${userName}`}
                onClick={closeMenu}
              >
                <User size={16} aria-hidden="true" />
                {/* The person's name, cut short if it is long. */}
                <span className="max-w-[clamp(4rem,50vw-25rem,10rem)] truncate max-nav:max-w-40">
                  {userName}
                </span>
              </Link>
            ) : isPending ? (
              // Keep the spot while we find out who is signed in, so the
              // button doesn't flash "Login" for people who are.
              <span
                className={`${navButton} invisible min-w-22 bg-brand-ink`}
                aria-hidden="true"
              />
            ) : (
              // Reading the URL has to sit behind Suspense; until it is known
              // (and in the prerendered page) the link is a plain /auth.
              <Suspense
                fallback={
                  <LoginLink
                    href="/auth"
                    currentPage={currentPage}
                    onClick={closeMenu}
                  />
                }
              >
                <ReturningLoginLink
                  currentPage={currentPage}
                  onClick={closeMenu}
                />
              </Suspense>
            )}
            <Link
              href="/add_a_cat"
              className={`${navButton} hover:bg-active active:bg-active aria-[current]:bg-active`}
              aria-current={currentPage === "list" ? "page" : undefined}
              onClick={closeMenu}
            >
              <PawIcon />
              List a cat
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
