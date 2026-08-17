import Link from "next/link";
import type { ResultsPeriod } from "@/lib/results";

export function ResultsFilter({ action, period }: { readonly action: string; readonly period: ResultsPeriod }) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 text-sm" method="get">
      <label className="grid gap-1 text-xs text-muted-foreground">
        開始日
        <input className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground" defaultValue={period.from} name="from" type="date" />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        終了日
        <input className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground" defaultValue={period.to} name="to" type="date" />
      </label>
      <button className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-accent" type="submit">
        絞り込む
      </button>
      {period.from || period.to ? <Link className="px-2 py-2 text-muted-foreground hover:text-foreground" href={action}>解除</Link> : null}
    </form>
  );
}
