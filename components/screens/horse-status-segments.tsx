import Link from "next/link";
import { DEFAULT_HORSE_STATUS, HORSE_STATUS_ORDER, horseStatusLabel, type HorseStatus } from "@/lib/horses";

export function HorseStatusSegments({ q, status }: { readonly q?: string; readonly status: HorseStatus }) {
  return (
    <nav aria-label="表示する馬" className="mb-4 inline-flex rounded-lg border border-border bg-muted p-1">
      {HORSE_STATUS_ORDER.map((segment) => {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (segment !== DEFAULT_HORSE_STATUS) params.set("status", segment);
        const query = params.toString();
        const selected = segment === status;

        return (
          <Link
            aria-current={selected ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              selected
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
            }`}
            href={query ? `/horses?${query}` : "/horses"}
            key={segment}
          >
            {horseStatusLabel(segment)}
          </Link>
        );
      })}
    </nav>
  );
}
