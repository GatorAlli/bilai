"use client";

import Image from "next/image";
import Link from "next/link";
import { LogIn, Menu, Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import "./navbar.css";

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
          <div className="bilai-nav-tabs" data-active={findCurrent ? "find" : currentPage}>
            <Link
              href="/"
              className="bilai-nav-tab"
              aria-current={currentPage === "home" ? "page" : undefined}
              onClick={closeMenu}
            >
              Home
            </Link>
            <Link
              href="/find_a_cat"
              className="bilai-nav-tab"
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
