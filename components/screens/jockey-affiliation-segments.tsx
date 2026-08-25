import Link from "next/link";
import {
  AFFILIATION_GROUPS,
  AFFILIATION_GROUP_ORDER,
  DEFAULT_AFFILIATION_GROUP,
  type AffiliationGroup,
} from "@/lib/jockeys";

export function JockeyAffiliationSegments({
  group,
  q,
}: {
  readonly group: AffiliationGroup;
  readonly q?: string;
}) {
  return (
    <nav
      aria-label="表示する騎手の所属"
      className="mb-4 inline-flex rounded-lg border border-border bg-muted p-1"
    >
      {AFFILIATION_GROUP_ORDER.map((candidate) => {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (candidate !== DEFAULT_AFFILIATION_GROUP) params.set("group", candidate);
        const query = params.toString();
        const selected = candidate === group;

        return (
          <Link
            aria-current={selected ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              selected
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
            }`}
            href={query ? `/jockeys?${query}` : "/jockeys"}
            key={candidate}
          >
            {AFFILIATION_GROUPS[candidate].label}
          </Link>
        );
      })}
    </nav>
  );
}
