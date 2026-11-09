"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AuthForm() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
    setIsPending(true);
    try {
      const credentials = { email: email.trim(), password };
      const result = isSignUp
        ? await authClient.signUp.email({ ...credentials, name: name.trim() })
        : await authClient.signIn.email(credentials);
      if (result.error) {
        const code = result.error.code;
        if (code === "INVALID_EMAIL_OR_PASSWORD" || code === "INVALID_PASSWORD") {
          setError("The email or password is incorrect.");
        } else if (code === "USER_ALREADY_EXISTS" || code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
          setError("An account with this email already exists. Please sign in.");
        } else if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") {
          setError("Use a password between 8 and 128 characters.");
        } else if (result.error.status === 429) {
          setError("Too many attempts. Please wait a moment and try again.");
        } else {
          setError(isSignUp ? "Couldn't create your account. Please try again." : "Couldn't sign in. Please try again.");
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

  function toggleMode() {
    setIsSignUp((value) => !value);
    setPassword("");
    setError(null);
  }

  return (
    <form onSubmit={handleSubmit} aria-labelledby="auth-heading" aria-busy={isPending} className="flex w-full max-w-md flex-col gap-6 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div>
        <h1 id="auth-heading" className="font-heading text-3xl font-bold">{isSignUp ? "Sign up" : "Sign in"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{isSignUp ? "Create an account to share a cat’s story." : "Welcome back to bilai."}</p>
      </div>
      {isSignUp ? <div className="flex flex-col gap-2">
        <Label htmlFor="auth-name" className="font-bold">Name</Label>
        <Input id="auth-name" name="name" autoComplete="name" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} disabled={isPending} className="h-11 bg-background" />
      </div> : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="auth-email" className="font-bold">Email</Label>
        <Input id="auth-email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={isPending} className="h-11 bg-background" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="auth-password" className="font-bold">Password</Label>
        <Input id="auth-password" name="password" type="password" autoComplete={isSignUp ? "new-password" : "current-password"} required minLength={isSignUp ? 8 : undefined} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} disabled={isPending} aria-describedby={isSignUp ? "password-hint" : undefined} className="h-11 bg-background" />
        {isSignUp ? <p id="password-hint" className="text-xs text-muted-foreground">Use at least 8 characters.</p> : null}
      </div>
      <p className="text-sm text-muted-foreground">
        {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
        <button type="button" onClick={toggleMode} disabled={isPending} className="rounded font-bold text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50">{isSignUp ? "Sign in" : "Sign Up"}</button>
      </p>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isPending} variant="secondary" className="h-11 w-full font-bold">
        {isPending ? (isSignUp ? "Creating account…" : "Signing in…") : (isSignUp ? "Sign up" : "Sign in")}
      </Button>
    </form>
  );
}
