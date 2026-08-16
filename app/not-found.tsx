import Link from "next/link";
import { PageShell } from "@/components/screens/page-shell";
import { getViewer } from "@/lib/auth";

/**
 * 見つからなかったとき。
 *
 * **見せられない画面もここへ来る**（`assertCan` は 404 にする。「ここに何かがある」ことも
 * 隠すため）。なので、ログインすれば見えるかもしれないことを書いておく。
 */
export default async function NotFound() {
  const viewer = await getViewer();

  return (
    <PageShell lead="この URL には何もありません。" title="見つかりません">
      {viewer === "public" ? (
        <p className="text-sm text-muted-foreground">
          ログインすると見られる画面かもしれません。
          <Link className="ml-1 underline hover:no-underline" href="/login">
            ログイン
          </Link>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          いまは <span className="font-mono uppercase">{viewer}</span> として見ています。
          この画面はもう1つ上のレベルが要るか、そもそも存在しません。
        </p>
      )}
      <p className="mt-6 text-sm">
        <Link className="underline hover:no-underline" href="/">
          まとめの画面へ戻る
        </Link>
      </p>
    </PageShell>
  );
}
