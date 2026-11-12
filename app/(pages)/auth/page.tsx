import AuthForm from "@/components/auth/AuthForm";
import BilaiPage from "@/components/view/BilaiPage";
import LoginBackdrop from "./LoginBackdrop";
import "./auth.css";

export default function LoginPage() {
  return (
    <BilaiPage
      currentPage="login"
      mainClassName="bilai-frame bilai-inner bilai-auth-main flex items-center justify-center"
    >
      <LoginBackdrop />
      <AuthForm />
    </BilaiPage>
  );
}
