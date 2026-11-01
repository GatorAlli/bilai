import Link from "next/dist/client/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-[#FAF6EE] font-sans">
      <p className="text-mauve-950 font-bold ">This is the landing page</p>
      <Link
        href="/login"
        className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-700"
      >
        Login
      </Link>
    </div>
  );
}
