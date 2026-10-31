"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { authClient } from "@/lib/auth/client";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const signUp = mode === "sign-up";
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function google() {
    setError(""); setPending("google");
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: new URL("/dashboard", window.location.origin).toString() });
      if (result.error) { setError(result.error.message ?? "Google sign-in could not be started."); setPending(null); }
    } catch { setError("Sign-in is unavailable right now. Please try again."); setPending(null); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending("email");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    try {
      const result = signUp
        ? await authClient.signUp.email({ email, password, name: String(data.get("name") ?? "").trim() })
        : await authClient.signIn.email({ email, password });
      if (result.error) { setError(result.error.message ?? "Check your details and try again."); setPending(null); return; }
      router.push("/dashboard");
      router.refresh();
    } catch { setError("Sign-in is unavailable right now. Please try again."); setPending(null); }
  }

  return <div className="auth-form-wrap">
    <button className="button button-google" type="button" onClick={google} disabled={Boolean(pending)}>
      {pending === "google" ? <LoaderCircle size={18} className="spin"/> : <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.2H24v7.9h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1a12.3 12.3 0 0 1-18.3-6.4H5.8v5.3A20.4 20.4 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.6a12.3 12.3 0 0 1 0-7.2v-5.3H5.8a20.4 20.4 0 0 0 0 17.8l6.8-5.3Z"/><path fill="#EA4335" d="M24 11.7c3.1 0 5.9 1.1 8.1 3.2l6.1-6.1A20.4 20.4 0 0 0 5.8 15l6.8 5.3A12.2 12.2 0 0 1 24 11.7Z"/></svg>}
      Continue with Google
    </button>
    <div className="form-divider"><span/>or use your email<span/></div>
    <form onSubmit={submit} className="form-stack">
      {signUp && <label>Your name<input name="name" autoComplete="name" placeholder="Alex Rivera" required maxLength={120}/></label>}
      <label>Email address<input type="email" name="email" autoComplete="email" placeholder="you@example.com" required maxLength={254}/></label>
      <label>Password<input type="password" name="password" autoComplete={signUp ? "new-password" : "current-password"} placeholder={signUp ? "At least 8 characters" : "Your password"} required minLength={8} maxLength={128}/></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="button button-dark button-full" disabled={Boolean(pending)}>{pending === "email" ? <><LoaderCircle size={17} className="spin"/> One moment…</> : <>{signUp ? "Create your account" : "Log in"}<ArrowUpRight size={17}/></>}</button>
    </form>
    <p className="auth-switch">{signUp ? "Already have an account?" : "New to ReScene?"} <Link href={signUp ? "/auth/sign-in" : "/auth/sign-up"}>{signUp ? "Log in" : "Create an account"}</Link></p>
  </div>;
}
