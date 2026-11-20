"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteCatListing } from "@/app/(pages)/find_a_cat/[publicId]/delete-actions";

// "Mark adopted" is wired to the same removal flow as "Remove listing" for
// now; it gets its own server action (that updates status instead of
// deleting) in a later change.
export default function DeleteListingButton({
  publicId,
}: {
  publicId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function removeListing() {
    if (pending) return;
    if (
      !window.confirm(
        "Delete this listing and its photos? This cannot be undone.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteCatListing(publicId);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.replace("/find_a_cat");
        router.refresh();
      } catch {
        setError("Couldn't delete the listing. Please try again.");
      }
    });
  }

  return (
    <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={removeListing}
        className="min-h-11 gap-2 px-4 font-bold"
      >
        <Check size={16} aria-hidden="true" />
        Mark adopted
      </Button>
      <Button
        type="button"
        variant="destructive"
        disabled={pending}
        onClick={removeListing}
        className="min-h-11 gap-2 px-4 font-bold"
      >
        <Trash2 size={16} aria-hidden="true" />
        {pending ? "Removing…" : "Remove listing"}
      </Button>
      {error && (
        <p role="alert" className="mt-2 w-full text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
