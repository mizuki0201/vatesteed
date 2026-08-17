import Link from "next/link";
import type { HorseStatus } from "@/lib/horses";

const segments: readonly { readonly status: HorseStatus; readonly label: string }[] = [
  { status: "all", label: "すべて" },
  { status: "active", label: "現役" },
  { status: "retired", label: "引退" },
];

export function HorseStatusSegments({ q, status }: { readonly q?: string; readonly status: HorseStatus }) {
  return (
    <nav aria-label="表示する馬" className="mb-4 inline-flex rounded-lg border border-border bg-muted p-1">
      {segments.map((segment) => {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (segment.status !== "active") params.set("status", segment.status);
        const query = params.toString();
        const selected = segment.status === status;

        return (
          <Link
            aria-current={selected ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              selected
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
            }`}
            href={query ? `/horses?${query}` : "/horses"}
            key={segment.status}
          >
            {segment.label}
          </Link>
        );
      })}
    </nav>
  );
}
