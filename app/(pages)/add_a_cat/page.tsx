import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import BilaiPage from "@/components/view/BilaiPage";
import { headingText, headingTitle } from "@/components/view/styles";
import { getSession } from "@/lib/auth";
import ListACat from "./ListACat";

export const metadata: Metadata = { title: "List a cat" };

// Reads the session, so it has to sit behind a Suspense boundary.
// Signed-out visitors are sent to the login page.
async function RequireSignIn() {
  const session = await getSession();
  if (!session?.user) redirect("/auth");
  return <ListACat />;
}

export default function ListACatPage() {
  return (
    <BilaiPage
      currentPage="list"
      mainClassName="frame grid grid-cols-[minmax(14rem,1fr)_minmax(0,2.35fr)] items-start gap-x-[clamp(2rem,5vw,5rem)] gap-y-6 py-section max-nav:grid-cols-1"
    >
      <header>
        <h1 id="list-title" className={headingTitle}>
          List a cat
        </h1>
        <p className={headingText}>
          Share a recent photo and tell adopters what they should know about
          your cat.
        </p>
      </header>
      <Suspense
        fallback={
          <p role="status" className="py-8">
            Loading…
          </p>
        }
      >
        <RequireSignIn />
      </Suspense>
    </BilaiPage>
  );
}
