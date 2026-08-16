"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  checkOwnerPassword,
  createSessionValue,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth";

/**
 * パスワードを確かめて、合っていれば署名付きの Cookie を置く。
 *
 * **Cookie を書けるのはここ（Server Function）と Route Handler だけ**なので、ログインの
 * 入口はフォームの送信にしてある。
 *
 * 失敗は `/login?error=1` へ戻す。**入力を保持しない**（パスワードなので残さない）。
 */
export async function login(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  const secret = process.env.AUTH_SECRET;

  if (!secret) redirect("/login?error=setup");
  if (!checkOwnerPassword(password)) redirect("/login?error=1");

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, createSessionValue("owner", secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  redirect("/");
}

/** Cookie を消す。 */
export async function logout(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/");
}
