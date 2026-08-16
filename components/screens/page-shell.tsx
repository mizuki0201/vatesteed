import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 画面ごとに共通の外枠。見出し・説明・本文の並びだけを持つ。 */
export function PageShell({
  title,
  lead,
  back,
  actions,
  children,
}: {
  readonly title: string;
  readonly lead?: ReactNode;
  readonly back?: { readonly href: string; readonly label: string };
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 pb-24 pt-10 text-foreground">
      {back ? (
        <Link
          className="mb-6 inline-block text-sm text-muted-foreground hover:text-foreground"
          href={back.href}
        >
          ← {back.label}
        </Link>
      ) : null}

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {lead ? <div className="mt-2 text-sm text-muted-foreground">{lead}</div> : null}
        </div>
        {actions}
      </header>

      {children}
    </main>
  );
}

/** 節の見出し。 */
export function Section({
  title,
  note,
  children,
  className,
}: {
  readonly title: string;
  readonly note?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <section className={cn("mt-10 first:mt-0", className)}>
      <div className="mb-3 flex flex-wrap items-baseline gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** 中身が無いときの表示。**何が無いのかを書く。** */
export function Empty({ children }: { readonly children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

/** 囲み。一覧の行や、評価の本文を入れる。 */
export function Card({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 text-card-foreground", className)}>
      {children}
    </div>
  );
}
