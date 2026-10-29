"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth/client";

export function SignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  return <button className="signout-button" disabled={pending} onClick={async () => {
    setPending(true); setFailed(false);
    try {
      const result = await authClient.signOut();
      if (result.error) { setFailed(true); setPending(false); return; }
      router.replace("/");
      router.refresh();
    } catch { setFailed(true); setPending(false); }
  }}><LogOut size={15}/>{failed ? "Retry sign out" : pending ? "Signing out…" : "Sign out"}</button>;
}
