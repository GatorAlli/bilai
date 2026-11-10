"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export const SignOutButton = () => {
  const router = useRouter();

  const signOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/auth");
          router.refresh();
        },
      },
    });
  };

  return (
    <Button type="button" variant="outline" size="lg" onClick={signOut}>
      <LogOut aria-hidden="true" />
      Sign out
    </Button>
  );
};
