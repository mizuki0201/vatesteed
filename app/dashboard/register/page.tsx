import Link from "next/link";
import type { Metadata } from "next";
import { Card, PageShell } from "@/components/screens/page-shell";
import { assertCan } from "@/lib/access";

export const metadata: Metadata = { title: "データを登録する — Vatesteed" };

/**
 * 事実データの登録画面へのリンクだけを並べる（docs/product.md#画面）。
 *
 * 出走は、馬・騎手・レースが登録してある前提で入れるので最後に置く。
 */
const REGISTERS: readonly { readonly href: string; readonly label: string }[] = [
  { href: "/dashboard/register/course", label: "コース" },
  { href: "/dashboard/register/jockey", label: "騎手" },
  { href: "/dashboard/register/trainer", label: "厩舎" },
  { href: "/dashboard/register/horse", label: "馬" },
  { href: "/dashboard/register/race", label: "レース" },
  { href: "/dashboard/register/entry", label: "出走" },
];

export default async function Page() {
  await assertCan("data.edit");

  return (
    <PageShell back={{ href: "/dashboard", label: "ダッシュボード" }} title="データを登録する">
      <ul className="grid gap-3 sm:grid-cols-3">
        {REGISTERS.map((item) => (
          <li key={item.href}>
            <Link href={item.href}>
              <Card className="font-semibold tracking-tight transition-colors hover:border-foreground/30">
                {item.label}
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
