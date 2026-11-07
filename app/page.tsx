import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-[#FAF6EE] font-sans">
      <h1 className="font-brand p-10 text-6xl">bilai.</h1>
      <p className="text-mauve-950 font-bold">This is the landing page</p>
      <Link
        href="/login"
        className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-700"
      >
        Login
      </Link>
    </div>
  );
}
