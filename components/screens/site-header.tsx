import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { can, type Capability } from "@/lib/access";

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
  { href: "/notes", label: "読み", capability: "notes.raw" },
  { href: "/dashboard", label: "裏側", capability: "dashboard" },
];

export async function SiteHeader() {
  const viewer = await getViewer();
  const items = NAV.filter((item) => can(viewer, item.capability));

  return (
    <header className="border-b border-border">
      <nav className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3 text-sm">
        <Link className="font-semibold tracking-tight" href="/">
          🐎 Vatesteed
        </Link>

        {items.map((item) => (
          <Link
            className="text-muted-foreground hover:text-foreground"
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        ))}

        <span className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
          <Link className="hover:text-foreground" href="/tech">
            技術情報
          </Link>
          <Link className="hover:text-foreground" href="/about">
            これは何か
          </Link>
          {viewer === "public" ? (
            <Link className="hover:text-foreground" href="/login">
              ログイン
            </Link>
          ) : (
            <span className="font-mono tracking-[0.15em] uppercase">{viewer}</span>
          )}
        </span>
      </nav>
    </header>
  );
}
