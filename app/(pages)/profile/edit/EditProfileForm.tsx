"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeBdPhone, PHONE_ERROR } from "@/lib/phone";
import { updateProfile } from "./actions";

export default function EditProfileForm({
  initialName,
  initialPhone,
  email,
}: {
  initialName: string;
  /** Stored form (8801712345678) or empty. */
  initialPhone: string;
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  // Show it the way people type it: 01712345678.
  const [phone, setPhone] = useState(
    initialPhone ? `0${initialPhone.slice(3)}` : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if ((phone.trim() || initialPhone) && !normalizeBdPhone(phone)) {
      setError(PHONE_ERROR);
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateProfile({ name, phone });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        // Make the navbar (which reads the session in the browser) refetch.
        authClient.$store.notify("$sessionSignal");
        router.push("/profile");
        router.refresh();
      } catch (err) {
        console.error(err);
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={isPending}
      className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8"
    >
      <h1 className="font-heading text-3xl font-bold">Edit profile</h1>

      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-name" className="font-bold">
          Name
        </Label>
        <Input
          id="edit-name"
          name="name"
          autoComplete="name"
          required
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={isPending}
          className="h-11 bg-background text-mauve-950"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-phone" className="font-bold">
          Phone number
        </Label>
        <Input
          id="edit-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required={Boolean(initialPhone)}
          maxLength={20}
          placeholder="01712345678"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          disabled={isPending}
          aria-describedby="edit-phone-hint"
          className="h-11 bg-background text-mauve-950"
        />
        <p id="edit-phone-hint" className="text-xs text-muted-foreground">
          A Bangladesh mobile number. Adopters use it to reach you about your
          cats.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-email" className="font-bold">
          Email
        </Label>
        <Input
          id="edit-email"
          value={email}
          readOnly
          disabled
          className="h-11 bg-muted"
        />
        <p className="text-xs text-muted-foreground">
          Your email can&rsquo;t be changed here.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          variant="secondary"
          size="lg"
          disabled={isPending}
          className="h-11 px-5 font-bold"
        >
          {isPending ? "Saving…" : "Save changes"}
        </Button>
        <Link
          href="/profile"
          className={buttonVariants({
            variant: "outline",
            size: "lg",
            className: "h-11 px-5",
          })}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
