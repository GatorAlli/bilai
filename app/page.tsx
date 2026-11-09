import Image from "next/image";
import Link from "next/link";
import { LogIn, Plus, Search } from "lucide-react";

function NavBar() {
  return (
    <header className="bg-[#FAF6EE]">
      <div className="wrap">
        <nav className="relative flex items-center justify-between py-5">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="bilai logo"
              width={48}
              height={48}
              priority
              className="size-12 mix-blend-multiply"
            />
            <span className="font-brand text-3xl leading-none text-mauve-950">
              bilai.
            </span>
          </Link>

          <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 text-sm font-medium text-mauve-950 md:flex">
            <li>
              <Link
                href="/"
                className="border-b-2 border-[#ff7640] py-2"
                aria-current="page"
              >
                Find a cat
              </Link>
            </li>
            <li>
              <Link
                href="/#how-it-works"
                className="border-b-2 border-transparent py-2 hover:border-mauve-950/30"
              >
                How it works
              </Link>
            </li>
          </ul>

          <div className="flex items-center gap-3 sm:gap-5">
            <Link
              href="/auth"
              className="flex items-center gap-2 rounded-lg bg-mauve-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-mauve-900"
            >
              <LogIn className="size-4" aria-hidden />
              Login
            </Link>
            <Link
              href="/add_a_cat"
              className="flex items-center gap-2 rounded-lg border border-mauve-950 px-4 py-2 text-sm font-semibold text-mauve-950 transition-colors hover:bg-mauve-950 hover:text-white"
            >
              <Plus className="size-4" aria-hidden />
              List a cat
            </Link>
          </div>
        </nav>

        <form action="/" role="search" className="pb-5">
          <div className="flex h-12 overflow-hidden rounded-lg border border-mauve-950/20 bg-[#FFFEF7] focus-within:border-mauve-950">
            <input
              type="search"
              name="q"
              placeholder="Search cats or areas"
              aria-label="Search cats or areas"
              className="flex-1 bg-transparent px-4 text-sm text-mauve-950 outline-none placeholder:text-mauve-950/50"
            />
            <button
              type="submit"
              aria-label="Search"
              className="flex w-12 items-center justify-center border-l border-mauve-950/20 text-mauve-950 hover:bg-mauve-950 hover:text-white"
            >
              <Search className="size-4" aria-hidden />
            </button>
          </div>
        </form>
      </div>
    </header>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-[#FAF6EE] font-sans">
      <NavBar />
      <main className="wrap flex flex-1 items-center justify-center">
        <p className="font-bold text-mauve-950">This is the landing page</p>
      </main>
    </div>
  );
}
