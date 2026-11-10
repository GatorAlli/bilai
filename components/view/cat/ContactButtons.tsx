"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MessageCircle, Phone } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { getContactUrl } from "@/app/(pages)/find_a_cat/[id]/actions";
import type { ContactMethod } from "@/lib/cat-limits";

type Props = {
  catId: number;
  whatsapp: boolean;
  call: boolean;
  isLoggedIn: boolean;
  isOwner: boolean;
};

export default function ContactButtons({
  catId,
  whatsapp,
  call,
  isLoggedIn,
  isOwner,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ContactMethod | null>(null);
  const [, startTransition] = useTransition();

  if (!whatsapp && !call) return null;

  if (isOwner) {
    return (
      <p className="text-sm text-muted-foreground">
        This is your listing. Adopters can reach you by{" "}
        {[whatsapp && "WhatsApp", call && "phone call"]
          .filter(Boolean)
          .join(" or ")}
        .
      </p>
    );
  }

  if (!isLoggedIn) {
    return (
      <Link
        href="/auth"
        className={buttonVariants({ variant: "outline", size: "lg" })}
      >
        Log in to contact the parent
      </Link>
    );
  }

  function contact(method: ContactMethod) {
    setError(null);
    setPending(method);

    // Browsers block tabs opened after waiting on the server, so open the
    // WhatsApp tab now, while we still have the click, and fill it in later.
    const tab = method === "whatsapp" ? window.open("", "_blank") : null;
    if (tab) tab.opener = null;

    startTransition(async () => {
      try {
        const result = await getContactUrl(catId, method);
        if (!result.ok) {
          tab?.close();
          setError(result.error);
          return;
        }
        if (tab) tab.location.href = result.url;
        else window.location.href = result.url;
      } catch (err) {
        console.error(err);
        tab?.close();
        setError("Something went wrong. Please try again.");
      } finally {
        setPending(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        {whatsapp && (
          <Button
            type="button"
            size="lg"
            disabled={pending !== null}
            onClick={() => contact("whatsapp")}
            className="h-11 bg-[#25d366] px-4 font-bold text-mauve-950 hover:bg-[#25d366]/85"
          >
            <MessageCircle />
            {pending === "whatsapp" ? "Opening…" : "WhatsApp"}
          </Button>
        )}
        {call && (
          <Button
            type="button"
            size="lg"
            variant="outline"
            disabled={pending !== null}
            onClick={() => contact("call")}
            className="h-11 px-4 font-bold"
          >
            <Phone />
            {pending === "call" ? "Opening…" : "Call"}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
