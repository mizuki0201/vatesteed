import { cache } from "react";
import { cookies } from "next/headers";
import { ACCESS_LEVELS, type AccessLevel } from "../enums/index.ts";
import { readSessionValue, SESSION_COOKIE_NAME } from "./session.ts";

/**
 * いま見ている人の閲覧レベルを返す。**判定はここ1箇所に閉じる。**
 *
 * 入口（パスワードか、将来の Magic Link か）が変わっても、この関数から先は変わらない。
 *
 * `cache()` で包んでいるので、1リクエストの中で何度呼んでも Cookie を読むのは1回だけ。
 */
export const getViewer = cache(async (): Promise<AccessLevel> => {
  const forced = getDevViewer();
  if (forced) return forced;

  const secret = process.env.AUTH_SECRET;
  if (!secret) return "public";

  const cookieStore = await cookies();

  return readSessionValue(cookieStore.get(SESSION_COOKIE_NAME)?.value, secret) ?? "public";
});

/**
 * 開発中だけ、認証を飛ばして固定のレベルで見る。
 *
 * **本番では効かない。** `NODE_ENV` が `production` のときは、環境変数が入っていても無視する。
 * ここが抜けると、本番に `DEV_VIEWER` を1つ置くだけで全部見えてしまう。
 */
function getDevViewer(): AccessLevel | undefined {
  if (process.env.NODE_ENV === "production") return undefined;

  const value = process.env.DEV_VIEWER;

  return ACCESS_LEVELS.find((level) => level === value);
}
