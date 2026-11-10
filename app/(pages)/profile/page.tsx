import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, Pencil, Phone, Plus } from "lucide-react";
import Navbar from "@/components/view/navbar/Navbar";
import { buttonVariants } from "@/components/ui/button";
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

// 8801712345678 -> +880 1712-345678
function formatPhone(phone: string) {
  return `+${phone.slice(0, 3)} ${phone.slice(3, 7)}-${phone.slice(7)}`;
}

function initials(name: string) {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return letters || "?";
}

// Reads the session, so it has to sit behind the Suspense above.
async function YourProfile() {
  const session = await getSession();
  if (!session?.user) redirect("/auth");

  const { name, email, phone, createdAt } = session.user;

  return (
    <article className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden="true"
          className="grid size-16 shrink-0 place-items-center rounded-full bg-secondary font-heading text-2xl font-bold text-secondary-foreground"
        >
          {initials(name)}
        </span>
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-bold break-words">
            {name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Member since{" "}
            {createdAt.toLocaleDateString("en-GB", {
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      <dl className="mt-8 flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="text-sm font-bold">Email</dt>
            <dd className="break-all">{email}</dd>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Phone className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <dt className="text-sm font-bold">Phone number</dt>
            <dd>
              {phone ? (
                formatPhone(phone)
              ) : (
                <span className="text-muted-foreground">
                  Not added yet. Add one with Edit profile.
                </span>
              )}
            </dd>
          </div>
        </div>
      </dl>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href="/profile/edit"
          className={buttonVariants({ variant: "secondary", size: "lg" })}
        >
          <Pencil aria-hidden="true" />
          Edit profile
        </Link>
        <Link
          href="/add_a_cat"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          <Plus aria-hidden="true" />
          List a cat
        </Link>
        <SignOutButton />
      </div>
    </article>
  );
}
