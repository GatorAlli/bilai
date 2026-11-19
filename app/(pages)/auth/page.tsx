import type { Metadata } from "next";
import AuthForm from "@/components/auth/AuthForm";
import BilaiPage from "@/components/view/BilaiPage";
import LoginBackdrop from "./LoginBackdrop";

// AuthForm switches this to "Sign Up" when the visitor toggles modes.
export const metadata: Metadata = { title: "Sign In" };

export default function LoginPage() {
  return (
    <BilaiPage
      currentPage="login"
      mainClassName="frame relative isolate flex items-center justify-center py-section max-[44rem]:py-20"
    >
      <LoginBackdrop />
      <AuthForm />
    </BilaiPage>
  );
}
