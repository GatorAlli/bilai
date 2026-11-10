import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col bg-[#FAF6EE] font-sans text-mauve-950">
      <header className="wrap flex items-center justify-between py-5">
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
        <Link
          href="/"
          className="flex items-center gap-2 border-b-2 border-transparent py-2 text-sm font-medium text-mauve-950 hover:border-[#FF7640]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to home
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-md rounded-2xl border border-mauve-950/10 bg-[#FFFEF7] p-8 shadow-sm">
          <div className="mb-8">
            <span className="mb-4 block h-1.5 w-12 rounded-full bg-[#FF7640]" />
            <h1 className="text-3xl font-bold text-mauve-950">Welcome back</h1>
            <p className="mt-2 text-sm text-mauve-950/70">
              Log in to find a friend or share a cat&apos;s story.
            </p>
          </div>
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
