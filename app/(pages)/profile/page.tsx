import { Suspense } from "react";
import { redirect } from "next/navigation";
import Navbar from "@/components/view/navbar/Navbar";
import { getSession } from "@/lib/auth";
import { SignOutButton } from "@/components/auth/signOut";


export default function ProfilePage() {
  return (
    <div className="theme-light flex flex-1 flex-col bg-background text-foreground">
      <Navbar currentPage="account" />
      <main className="wrap mx-auto w-full max-w-2xl py-8">
        <Suspense
          fallback={
            <p role="status" className="py-8">
              Loading your profile…
            </p>
          }
        >
          <YourProfile />
        </Suspense>
      </main>
    </div>
  );
}

// Reads the session, so it has to sit behind the Suspense above.
async function YourProfile() {
  const session = await getSession();
  if (!session?.user) redirect("/auth");

  const { name, email, phone, createdAt } = session.user;
}
