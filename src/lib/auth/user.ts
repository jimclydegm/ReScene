import "server-only";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/http";

export async function requireUser() {
  const { data: session, error } = await getAuth().getSession();
  if (error) throw new AppError(503, "AUTH_UNAVAILABLE", "Sign-in is temporarily unavailable. Please try again.");
  if (!session?.user) throw new AppError(401, "UNAUTHORIZED", "Sign in to continue.");
  return getDb().appUser.upsert({
    where: { authSubject: session.user.id },
    create: { authSubject: session.user.id, displayName: session.user.name?.slice(0, 120) ?? null },
    update: { displayName: session.user.name?.slice(0, 120) ?? null }
  });
}

export async function requirePageUser() {
  try { return await requireUser(); }
  catch (error) {
    if (error instanceof AppError && error.status === 401) redirect("/auth/sign-in");
    throw error;
  }
}
