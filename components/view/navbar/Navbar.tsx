"use client";

import Image from "next/image";
import Link from "next/link";
import { LogIn, Menu, Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import "./navbar.css";

const tabClassName =
  "relative grid min-h-11 place-items-center bg-transparent px-4 text-[0.9375rem] font-semibold whitespace-nowrap text-[#505b6b] transition-colors hover:text-[#e66c35] aria-[current]:text-[#e66c35] after:pointer-events-none after:absolute after:inset-x-4 after:-bottom-px after:h-[3px] after:origin-left after:scale-x-0 after:bg-[#e66c35] after:transition-transform after:duration-200 after:content-[''] hover:after:scale-x-100 focus-visible:after:scale-x-100 aria-[current]:after:scale-x-100 motion-reduce:transition-none motion-reduce:after:transition-none max-[54rem]:justify-items-start max-[54rem]:px-3 max-[54rem]:after:inset-x-3";

type Page = "home" | "find" | "profile" | "login" | "list";

export default function Navbar({ currentPage }: { currentPage: Page }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const desktop = window.matchMedia("(width > 54rem)");
    const closeMenu = () => setMenuOpen(false);

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) {
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
    <header ref={headerRef} className="bilai-nav-header">
      <div className="bilai-nav-bar">
        <Link href="/" className="bilai-nav-brand" aria-label="Bilai home" onClick={closeMenu}>
          <Image src="/logo.png" alt="" width={48} height={48} loading="eager" />
          <span>bilai.</span>
        </Link>
        <button
          ref={menuButtonRef}
          type="button"
          className="bilai-nav-menu-button"
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
          className="bilai-nav-navigation"
          data-open={menuOpen}
        >
          <div className="absolute inset-y-0 left-1/2 grid -translate-x-1/2 grid-cols-2 items-stretch gap-4 max-[54rem]:static max-[54rem]:translate-x-0 max-[54rem]:grid-cols-1">
            <Link
              href="/"
              className={tabClassName}
              aria-current={currentPage === "home" ? "page" : undefined}
              onClick={closeMenu}
            >
              Homepage
            </Link>
            <Link
              href="/find_a_cat"
              className={tabClassName}
              aria-current={findCurrent ? (currentPage === "find" ? "page" : "location") : undefined}
              onClick={closeMenu}
            >
              Find a cat
            </Link>
          </div>
          <div className="bilai-nav-actions">
            <Link
              href="/auth"
              className="bilai-nav-login"
              aria-current={currentPage === "login" ? "page" : undefined}
              onClick={closeMenu}
            >
              <LogIn size={16} aria-hidden="true" />
              Login
            </Link>
            <Link
              href="/add_a_cat"
              className="bilai-nav-list"
              aria-current={currentPage === "list" ? "page" : undefined}
              onClick={closeMenu}
            >
              <Plus size={16} aria-hidden="true" />
              List a cat
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
