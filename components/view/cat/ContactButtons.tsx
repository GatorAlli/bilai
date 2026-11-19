"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Phone } from "lucide-react";
import { loginUrl } from "@/lib/auth-redirect";
import { Button, buttonVariants } from "@/components/ui/button";
import { getContactUrl } from "@/app/(pages)/find_a_cat/[id]/actions";
import ChatButton from "@/components/view/cat/ChatButton";
import type { ContactMethod } from "@/lib/cat-limits";

type Props = {
  catId: number;
  catName: string;
  // Signed in and not the lister. Chat needs no phone number, so it shows
  // even when WhatsApp/Call can't.
  canChat: boolean;
  whatsapp: boolean;
  call: boolean;
  hasPhone: boolean;
  isLoggedIn: boolean;
  isOwner: boolean;
};

export default function ContactButtons({
  catId,
  catName,
  canChat,
  whatsapp,
  call,
  hasPhone,
  isLoggedIn,
  isOwner,
}: Props) {
  const pathname = usePathname();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ContactMethod | null>(null);
  const [, startTransition] = useTransition();

  // Signed-out visitors still get the login link: chat is available once
  // they sign in, whatever phone methods the parent enabled.
  if (!whatsapp && !call && !canChat && isLoggedIn) return null;

  if (isOwner && !hasPhone) {
    return (
      <p className="text-sm text-muted-foreground">
        Adopters can message you in Bilai chat. They can&apos;t WhatsApp or call
        you because your account has no phone number; you&apos;ll be asked for
        one when you list your next cat.
      </p>
    );
  }

  if (isOwner) {
    return (
      <p className="text-sm text-muted-foreground">
        This is your listing. Adopters can reach you by{" "}
        {new Intl.ListFormat("en", { type: "disjunction" }).format(
          ["Bilai chat", whatsapp && "WhatsApp", call && "phone call"].filter(
            (method): method is string => Boolean(method),
          ),
        )}
        .
      </p>
    );
  }

  const noPhoneNote = (
    <p className="text-sm text-muted-foreground">
      The parent hasn&apos;t added a phone number yet.
    </p>
  );

  if (!isLoggedIn) {
    // Chat needs no phone number, so signed-out visitors can always log in
    // to message the parent; login returns them to this cat.
    return (
      <Link
        href={loginUrl(pathname)}
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
        {canChat && <ChatButton catId={catId} catName={catName} />}
        {hasPhone && whatsapp && (
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
        {hasPhone && call && (
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
      {!hasPhone && noPhoneNote}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
