"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export const SignOutButton = () => {
  const router = useRouter();

  const signOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/auth");
        },
      },
    });
  };

  return (
    <button
      onClick={signOut}
      className="rounded-lg bg-gray-900 px-4 py-2 font-semibold text-white hover:bg-gray-700"
    >
      Sign out
    </button>
  );
};
