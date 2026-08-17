import Link from "next/link";
import { logout } from "@/app/login/actions";
import { can, type Capability } from "@/lib/access";
import { getViewer } from "@/lib/auth";

/**
 * 全画面の上に出るナビ。
 *
 * **見えないものはリンクを出さない。** ただし、ここで隠すのは表示の都合であって守りではない。
 * 守りはデータを取る側（`assertCan`）にある。
 */
const NAV: readonly { href: string; label: string; capability: Capability }[] = [
  { href: "/races", label: "レース", capability: "races" },
  { href: "/horses", label: "馬", capability: "horses" },
  { href: "/jockeys", label: "騎手", capability: "jockeys" },
  { href: "/trainers", label: "厩舎", capability: "trainers" },
  { href: "/courses", label: "コース", capability: "courses" },
  { href: "/results/ai", label: "成績", capability: "results.ai" },
  { href: "/notes", label: "分析", capability: "notes.raw" },
  { href: "/dashboard", label: "ダッシュボード", capability: "dashboard" },
];

function LogoutButton() {
  return (
    <form action={logout}>
      <button className="hover:text-foreground" type="submit">
        ログアウト
      </button>
    </form>
  );
}

export async function SiteHeader() {
  const viewer = await getViewer();
  const items = NAV.filter((item) => can(viewer, item.capability));

  return (
    <header className="border-b border-border">
      <nav className="mx-auto flex w-full max-w-5xl items-center px-6 py-3 text-sm">
        <Link className="font-semibold tracking-tight" href="/">
          🐎 Vatesteed
        </Link>

        <div className="ml-5 hidden flex-wrap items-center gap-x-5 gap-y-2 sm:flex">
          {items.map((item) => (
            <Link
              className="text-muted-foreground hover:text-foreground"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <span className="ml-auto hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
          <Link className="hover:text-foreground" href="/tech">
            技術情報
          </Link>
          <Link className="hover:text-foreground" href="/about">
            Vatesteedについて
          </Link>
          {viewer === "public" ? (
            <Link className="hover:text-foreground" href="/login">
              ログイン
            </Link>
          ) : (
            <>
              <span className="rounded-full bg-amber-100 px-2 py-1 font-mono text-[10px] tracking-[0.15em] text-amber-900 uppercase dark:bg-amber-900/50 dark:text-amber-100">
                {viewer}
              </span>
              <LogoutButton />
            </>
          )}
        </span>
        <details className="relative ml-auto sm:hidden">
          <summary className="cursor-pointer list-none rounded-md border border-border px-3 py-1.5 hover:bg-accent">
            <span aria-hidden="true">☰</span>
            <span className="sr-only">メニュー</span>
          </summary>
          <div className="absolute right-0 z-10 mt-2 flex w-52 flex-col gap-1 rounded-lg border border-border bg-card p-2 shadow-lg">
            {items.map((item) => (
              <Link className="rounded px-3 py-2 hover:bg-accent" href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
            <Link className="rounded px-3 py-2 hover:bg-accent" href="/tech">
              技術情報
            </Link>
            <Link className="rounded px-3 py-2 hover:bg-accent" href="/about">
              Vatesteedについて
            </Link>
            {viewer === "public" ? (
              <Link className="rounded px-3 py-2 hover:bg-accent" href="/login">
                ログイン
              </Link>
            ) : (
              <div className="rounded px-3 py-2 hover:bg-accent">
                <LogoutButton />
              </div>
            )}
          </div>
        </details>
      </nav>
    </header>
  );
}
