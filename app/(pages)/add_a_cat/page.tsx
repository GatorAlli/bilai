import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import BilaiPage from "@/components/view/BilaiPage";
import { headingText, headingTitle } from "@/components/view/styles";
import { getSession } from "@/lib/auth";
import { loginUrl } from "@/lib/auth-redirect";
import ListACat from "./ListACat";

export const metadata: Metadata = { title: "List a cat" };

// Reads the session, so it has to sit behind a Suspense boundary.
// Signed-out visitors are sent to the login page.
async function RequireSignIn() {
  const session = await getSession();
  if (!session?.user) redirect(loginUrl("/add_a_cat"));
  return <ListACat />;
}

export default function ListACatPage() {
  return (
    <BilaiPage
      currentPage="list"
      mainClassName="frame grid gap-y-10 py-section"
    >
      <header className="text-center">
        <h1 id="list-title" className={headingTitle}>
          List a cat
        </h1>
        <p className={`${headingText} mx-auto`}>
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
