import AuthForm from "@/components/auth/AuthForm";
import BilaiPage from "@/components/view/BilaiPage";
import LoginBackdrop from "./LoginBackdrop";

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
