"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import {requestNavigation} from "@/lib/client-navigation";
import { authClient } from "@/lib/auth/client";

export function SignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  async function signOut(){
    setPending(true); setFailed(false);
    try {
      const result = await authClient.signOut();
      if (result.error) { setFailed(true); setPending(false); return; }
      router.replace("/");
      router.refresh();
    } catch { setFailed(true); setPending(false); }
  }
  return <button className="signout-button" disabled={pending} onClick={()=>requestNavigation(()=>{void signOut();})}><LogOut size={15}/>{failed ? "Retry sign out" : pending ? "Signing out…" : "Sign out"}</button>;
}
