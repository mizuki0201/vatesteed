"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSessionValue,
  resolvePasswordLevel,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth";

/**
 * パスワードを確かめて、合っていれば署名付きの Cookie を置く。
 *
 * **入れた文字列でレベルが決まる。** 画面でレベルを選ばせない（選べる形にすると、友達に
 * 渡したパスワードで owner を名乗る試行ができる）。
 *
 * **Cookie を書けるのはここ（Server Function）と Route Handler だけ**なので、ログインの
 * 入口はフォームの送信にしてある。
 *
 * 失敗は `/login?error=1` へ戻す。**入力を保持しない**（パスワードなので残さない）。
 * **どのレベルに近かったかも返さない。**
 */
export async function login(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  const secret = process.env.AUTH_SECRET;

  if (!secret) redirect("/login?error=setup");

  const level = resolvePasswordLevel(password);

  if (!level) redirect("/login?error=1");

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, createSessionValue(level, secret), {
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
