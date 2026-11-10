"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeBdPhone, PHONE_ERROR, PHONE_TAKEN_ERROR } from "@/lib/phone";

export default function AuthForm() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    setError(null);
    if (isSignUp && !name.trim()) {
      setError("Please enter your name.");
      return;
    }
    // Check the number here for a quick error; the server checks it again.
    const normalizedPhone = isSignUp ? normalizeBdPhone(phone) : null;
    if (isSignUp && !normalizedPhone) {
      setError(PHONE_ERROR);
      return;
    }
    setIsPending(true);
    try {
      const credentials = { email: email.trim(), password };
      const result = isSignUp
        ? await authClient.signUp.email({
            ...credentials,
            name: name.trim(),
            phone: normalizedPhone!,
          })
        : await authClient.signIn.email(credentials);
      if (result.error) {
        const code = result.error.code;
        if (
          result.error.message === PHONE_ERROR ||
          result.error.message === PHONE_TAKEN_ERROR
        ) {
          setError(result.error.message);
        } else if (
          code === "INVALID_EMAIL_OR_PASSWORD" ||
          code === "INVALID_PASSWORD"
        ) {
          setError("The email or password is incorrect.");
        } else if (
          code === "USER_ALREADY_EXISTS" ||
          code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
        ) {
          setError(
            "An account with this email already exists. Please sign in.",
          );
        } else if (
          code === "PASSWORD_TOO_SHORT" ||
          code === "PASSWORD_TOO_LONG"
        ) {
          setError("Use a password between 8 and 128 characters.");
        } else if (result.error.status === 429) {
          setError("Too many attempts. Please wait a moment and try again.");
        } else {
          setError(
            isSignUp
              ? "Couldn't create your account. Please try again."
              : "Couldn't sign in. Please try again.",
          );
        }
        return;
      }
      router.replace("/find_a_cat");
      router.refresh();
    } catch {
      setError("Couldn't connect. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleGoogle() {
    if (isPending) return;
    setError(null);
    setIsPending(true);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/find_a_cat",
      });
      if (result.error) {
        setError("Couldn't continue with Google. Please try again.");
        setIsPending(false);
      }
    } catch {
      setError("Couldn't connect. Please try again.");
      setIsPending(false);
    }
  }

  function toggleMode() {
    setIsSignUp((value) => !value);
    setPassword("");
    setError(null);
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby="auth-heading"
      aria-busy={isPending}
      className="flex w-full max-w-md flex-col gap-6 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8"
    >
      <div>
        <h1 id="auth-heading" className="font-heading text-3xl font-bold">
          {isSignUp ? "Sign up" : "Sign in"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isSignUp
            ? "Create an account to share a cat’s story."
            : "Welcome back to bilai."}
        </p>
      </div>
      {isSignUp ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="auth-name" className="font-bold">
            Name
          </Label>
          <Input
            id="auth-name"
            name="name"
            autoComplete="name"
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isPending}
            className="h-11 bg-background"
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="auth-email" className="font-bold">
          Email
        </Label>
        <Input
          id="auth-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isPending}
          className="h-11 bg-background"
        />
      </div>
      {isSignUp ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="auth-phone" className="font-bold text-mauve-950">
            Phone number
          </Label>
          <Input
            id="auth-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            maxLength={20}
            placeholder="01712345678"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            disabled={isPending}
            aria-describedby="phone-hint"
            className="h-11 bg-background text-mauve-950"
          />
          <p id="phone-hint" className="text-xs text-muted-foreground">
            A Bangladesh mobile number. Adopters use it to reach you about
            your cats.
          </p>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="auth-password" className="font-bold">
          Password
        </Label>
        <Input
          id="auth-password"
          name="password"
          type="password"
          autoComplete={isSignUp ? "new-password" : "current-password"}
          required
          minLength={isSignUp ? 8 : undefined}
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isPending}
          aria-describedby={isSignUp ? "password-hint" : undefined}
          className="h-11 bg-background"
        />
        {isSignUp ? (
          <p id="password-hint" className="text-xs text-muted-foreground">
            Use at least 8 characters.
          </p>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
        <button
          type="button"
          onClick={toggleMode}
          disabled={isPending}
          className="rounded font-bold text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50"
        >
          {isSignUp ? "Sign in" : "Sign Up"}
        </button>
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={isPending}
        variant="secondary"
        className="h-11 w-full font-bold"
      >
        {isPending
          ? isSignUp
            ? "Creating account…"
            : "Signing in…"
          : isSignUp
            ? "Sign up"
            : "Sign in"}
      </Button>
      <div className="flex items-center gap-3 text-xs uppercase text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        onClick={handleGoogle}
        disabled={isPending}
        variant="outline"
        className="h-11 w-full gap-3 font-bold"
      >
        <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
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
        Continue with Google
      </Button>
    </form>
  );
}
