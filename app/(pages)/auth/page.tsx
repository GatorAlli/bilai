import { Suspense } from "react";
import type { Metadata } from "next";
import AuthForm from "@/components/auth/AuthForm";
import BilaiPage from "@/components/view/BilaiPage";
import { safeNext } from "@/lib/auth-redirect";
import LoginBackdrop from "./LoginBackdrop";

// AuthForm switches this to "Sign Up" when the visitor toggles modes.
export const metadata: Metadata = { title: "Sign In" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  return (
    <BilaiPage
      currentPage="login"
      mainClassName="frame relative isolate flex items-center justify-center py-section max-[44rem]:py-20"
    >
      <LoginBackdrop />
      <Suspense fallback={null}>
        <Form searchParams={searchParams} />
      </Suspense>
    </BilaiPage>
  );
}

// `next` is the page to return to after signing in (see lib/auth-redirect.ts).
// Reading it makes this part dynamic, so it sits behind the Suspense above.
async function Form({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return <AuthForm redirectTo={safeNext(next)} />;
}
