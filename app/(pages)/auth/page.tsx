import Navbar from "@/components/view/navbar/Navbar";
import Link from "next/link";

export default function LoginPage() {
  return (
    <>
      <Navbar />
    <div className="flex flex-col flex-1 items-center justify-center font-sans">
    This is the Login page
          <Link
        href="/"
        className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-700"
      >
        return to Home
      </Link>
    </div>
    </>
  );
}