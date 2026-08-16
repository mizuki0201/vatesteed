import type { Metadata } from "next";
import { Card, PageShell } from "@/components/screens/page-shell";
import { getViewer } from "@/lib/auth";
import { login, logout } from "./actions";

export const metadata: Metadata = { title: "ログイン — Vatesteed" };

const MESSAGE: Readonly<Record<string, string>> = {
  "1": "パスワードが合いません。",
  setup: "まだ設定が済んでいないため、ログインできません。",
};

/**
 * ログインの入口。
 *
 * **有効期間を画面に書かない。** 読む人に得が無く、いつまで有効かを知らせるぶんだけ損がある。
 * 切れたら入れ直してもらえばよい。
 *
 * **渡されたパスワードでレベルが決まる**ので、レベルを選ぶ欄も置かない。
 */
export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly error?: string }>;
}) {
  const { error } = await searchParams;
  const viewer = await getViewer();

  return (
    <PageShell lead="渡されたパスワードによって、見えるものが変わります。" title="ログイン">
      {viewer === "public" ? (
        <form action={login} className="max-w-sm space-y-3">
          <input
            aria-label="パスワード"
            autoComplete="current-password"
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
            name="password"
            placeholder="パスワード"
            type="password"
          />
          {error ? (
            <p className="text-sm text-destructive">{MESSAGE[error] ?? "入れませんでした。"}</p>
          ) : null}
          <button
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            type="submit"
          >
            入る
          </button>
        </form>
      ) : (
        <div className="max-w-sm space-y-3">
          <p className="text-sm text-muted-foreground">
            いまは <span className="font-mono uppercase">{viewer}</span> として見ています。
          </p>
          <form action={logout}>
            <button
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
              type="submit"
            >
              ログアウトする
            </button>
          </form>
        </div>
      )}

      <Card className="mt-8 max-w-sm">
        <p className="text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-card-foreground">この入り方は仮のものです。</span>
          今後、別のやり方に変わることがあります。
        </p>
      </Card>
    </PageShell>
  );
}
