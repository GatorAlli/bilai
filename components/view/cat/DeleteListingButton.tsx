"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteCatListing } from "@/app/(pages)/find_a_cat/[id]/delete-actions";

export default function DeleteListingButton({ catId }: { catId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function removeListing() {
    if (pending) return;
    if (!window.confirm("Delete this listing and its photos? This cannot be undone.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteCatListing(catId);
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
    <div className="mt-5 border-t border-border pt-5">
      <Button
        type="button"
        variant="destructive"
        disabled={pending}
        onClick={removeListing}
        className="min-h-11 gap-2 px-4 font-bold"
      >
        <Trash2 size={16} aria-hidden="true" />
        {pending ? "Deleting…" : "Delete listing"}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
