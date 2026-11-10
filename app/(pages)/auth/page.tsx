import AuthForm from "@/components/auth/AuthForm";
import BilaiPage from "@/components/view/BilaiPage";

export default function LoginPage() {
  return (
    <BilaiPage
      currentPage="login"
      mainClassName="bilai-frame bilai-inner flex items-center justify-center"
    >
      <AuthForm />
    </BilaiPage>
  );
}
