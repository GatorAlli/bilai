import Navbar from "@/components/view/navbar/Navbar";
import AuthForm from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <div className="theme-light flex flex-1 flex-col bg-background text-foreground">
      <Navbar currentPage="login" />
      <main className="wrap flex flex-1 items-center justify-center py-10">
        <AuthForm />
      </main>
    </div>
  );
}
