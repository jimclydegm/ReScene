import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
export const metadata: Metadata = { title: "Log in" };
export default function SignIn() { return <AuthShell mode="sign-in"/>; }
