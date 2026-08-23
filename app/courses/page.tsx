import Link from "next/link";
import type { Metadata } from "next";
import { Card, Empty, PageShell } from "@/components/screens/page-shell";
import { SearchForm } from "@/components/screens/search-form";
import { listCourses } from "@/lib/courses";

export const metadata: Metadata = { title: "コース — Vatesteed" };

export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string }>;
}) {
  const { q } = await searchParams;
  const courses = await listCourses({ q });

  return (
    <PageShell
      actions={<SearchForm action="/courses" defaultValue={q} placeholder="競馬場名" />}
      lead={`${courses.length} 件。競馬場・芝ダート・距離・内外の組み合わせで1つです。`}
      title="コース"
    >
      {courses.length === 0 ? (
        <Empty>
          {q ? `「${q}」に当たるコースはありません。` : "まだ見立てがあるコースはありません。"}
        </Empty>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {courses.map((course) => (
            <li key={course.id}>
              <Link href={`/courses/${course.id}`}>
                <Card className="h-full transition-colors hover:border-foreground/30">
                  <span className="font-semibold tracking-tight">
                    {course.track} {course.surface}
                    {course.distanceM}m
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {course.turn}回り{course.layout ? `・${course.layout}` : ""}
                  </span>
                  <p className="mt-1 font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
                    レース {course.raceCount} · {course.hasNote ? "見立てあり" : "見立てなし"}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
