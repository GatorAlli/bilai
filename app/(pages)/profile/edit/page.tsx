import { Suspense } from "react";
import { redirect } from "next/navigation";
import Navbar from "@/components/view/navbar/Navbar";
import { getSession } from "@/lib/auth";
import EditProfileForm from "./EditProfileForm";

export default function EditProfilePage() {
  return (
    <div className="theme-light flex flex-1 flex-col bg-background text-foreground">
      <Navbar currentPage="account" />
      <main className="wrap mx-auto w-full max-w-2xl py-8">
        <Suspense
          fallback={
            <p role="status" className="py-8">
              Loading…
            </p>
          }
        >
          <EditProfile />
        </Suspense>
      </main>
    </div>
  );
}

// Reads the session, so it has to sit behind the Suspense above.
async function EditProfile() {
  const session = await getSession();
  if (!session?.user) redirect("/auth");

  const { name, email, phone } = session.user;
  return (
    <EditProfileForm
      initialName={name}
      initialPhone={phone ?? ""}
      email={email}
    />
  );
}
