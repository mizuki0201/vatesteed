import { neon } from "@neondatabase/serverless";

/**
 * Neon への接続を返す。
 *
 * `DATABASE_URL` は PgBouncer 経由のプール接続。Vercel Functions のように
 * コネクションを保持できない環境で接続が枯渇しないよう、常にこちらを使う。
 * 直結が必要になった場合のみ `DATABASE_URL_UNPOOLED` を検討する。
 *
 * ローカルでは `vercel env pull .env.local` で取得した値を使う。
 */
export function getSql() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL が設定されていません。`pnpm vercel env pull .env.local` を実行してください。",
    );
  }

  return neon(url);
}
