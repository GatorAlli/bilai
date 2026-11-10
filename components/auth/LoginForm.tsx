"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { normalizeBdPhone, PHONE_ERROR } from "@/lib/phone";

function GoogleLogo() {
  return (
    <svg
      viewBox="0 0 48 48"
      className="size-5"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-mauve-950/20 bg-[#FFFEF7] px-4 text-sm text-mauve-950 outline-none transition-colors placeholder:text-mauve-950/50 focus:border-[#FF7640] focus:ring-2 focus:ring-[#FF7640]/30";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isSignup = mode === "signup";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Quick check here; the server checks the number again.
    const normalizedPhone = isSignup ? normalizeBdPhone(phone) : null;
    if (isSignup && !normalizedPhone) {
      setError(PHONE_ERROR);
      return;
    }
    setPending(true);

    const { error } = isSignup
      ? await authClient.signUp.email({
          name,
          email,
          password,
          phone: normalizedPhone!,
        })
      : await authClient.signIn.email({ email, password });

    setPending(false);
    if (error) {
      setError(error.message ?? "Something went wrong. Please try again.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function onGoogle() {
    setError(null);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
    });
    if (error) setError(error.message ?? "Could not sign in with Google.");
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={onGoogle}
        className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-mauve-950/20 bg-white text-sm font-semibold text-mauve-950 transition-colors hover:border-[#FF7640] hover:bg-[#FFFEF7]"
      >
        <GoogleLogo />
        Continue with Google
      </button>

      <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-mauve-950/60">
        <span className="h-px flex-1 bg-mauve-950/15" />
        or
        <span className="h-px flex-1 bg-mauve-950/15" />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {isSignup && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium text-mauve-950">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className={inputClass}
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-mauve-950">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
          />
        </div>

        {isSignup && (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="phone"
              className="text-sm font-medium text-mauve-950"
            >
              Phone number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              maxLength={20}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01712345678"
              className={inputClass}
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="text-sm font-medium text-mauve-950"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className={inputClass}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-mauve-950">
            <span className="mr-2 inline-block size-2 rounded-full bg-[#FF7640]" />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="h-11 w-full rounded-lg bg-[#FF7640] text-sm font-semibold text-white transition-colors hover:bg-[#f2642b] disabled:opacity-60"
        >
          {pending ? "Please wait…" : isSignup ? "Create account" : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-mauve-950">
        {isSignup ? "Already have an account?" : "New to bilai?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(isSignup ? "login" : "signup");
            setError(null);
          }}
          className="font-semibold underline decoration-[#FF7640] decoration-2 underline-offset-4 hover:text-[#FF7640]"
        >
          {isSignup ? "Log in" : "Sign up"}
        </button>
      </p>
    </div>
  );
}
