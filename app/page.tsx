import { Search } from "lucide-react";
import Navbar from "@/components/view/navbar/Navbar";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-[#FAF6EE] font-sans">
      <Navbar />
      <div className="wrap">
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
      <main className="wrap flex flex-1 items-center justify-center">
        <p className="font-bold text-mauve-950">This is the landing page</p>
      </main>
    </div>
  );
}
