import type { HorseStatus } from "@/lib/horses";

export function HorseSearchForm({ q, status }: { readonly q?: string; readonly status: HorseStatus }) {
  return (
    <form action="/horses" className="flex w-full max-w-md flex-wrap gap-2" method="get">
      <input
        aria-label="馬名を検索"
        className="min-w-40 grow rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
        defaultValue={q}
        name="q"
        placeholder="馬名"
        type="search"
      />
      <select className="rounded-lg border border-input bg-card px-3 py-2 text-sm" defaultValue={status} name="status">
        <option value="active">現役</option>
        <option value="retired">引退</option>
      </select>
      <button className="shrink-0 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-accent" type="submit">
        探す
      </button>
    </form>
  );
}
