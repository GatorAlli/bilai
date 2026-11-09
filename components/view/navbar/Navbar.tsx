import Image from "next/image";
import Link from "next/link";
import { LogIn, Plus } from "lucide-react";

export default function Navbar() {
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
      </div>
    </header>
  );
}
