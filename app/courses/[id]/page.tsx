import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Card, Empty, PageShell, Section } from "@/components/screens/page-shell";
import { NoteBody } from "@/components/screens/note-body";
import { getCourse, listCourseRaces } from "@/lib/courses";

export const metadata: Metadata = { title: "コース — Vatesteed" };

export default async function Page({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await getCourse(id);

  if (!course) notFound();

  const races = await listCourseRaces(id);

  return (
    <PageShell
      back={{ href: "/courses", label: "コースの一覧" }}
      lead={`${course.turn}回り${course.layout ? `・${course.layout}` : ""} · 登録されているレース ${races.length} 件`}
      title={`${course.track} ${course.surface}${course.distanceM}m`}
    >
      <Section note="いま時点の見立て。新しく分かったら書き換えます" title="コースの傾向">
        {course.note ? (
          <Card>
            <NoteBody author={course.note.author} body={course.note.body} />
          </Card>
        ) : (
          <Empty>
            まだ書いていません。1回のレースでは傾向が出ないので、何回か溜まってから書きます。
          </Empty>
        )}
      </Section>

      <Section note="このコースで行われたレース" title="レース">
        {races.length === 0 ? (
          <Empty>まだ登録されていません。</Empty>
        ) : (
          <ul className="space-y-2">
            {races.map((race) => (
              <li key={race.id}>
                <Link href={`/races/${race.id}`}>
                  <Card className="transition-colors hover:border-foreground/30">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <span className="font-mono text-xs text-muted-foreground">
                        {race.raceDate}
                      </span>
                      <span className="font-semibold tracking-tight">
                        {race.raceName ?? "（名前なし）"}
                      </span>
                      {race.grade ? (
                        <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">
                          {race.grade}
                        </span>
                      ) : null}
                      {race.trackCondition ? (
                        <span className="text-sm text-muted-foreground">
                          馬場 {race.trackCondition}
                        </span>
                      ) : null}
                      {race.hasNote ? (
                        <span className="ml-auto text-xs text-muted-foreground">振り返り済み</span>
                      ) : null}
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </PageShell>
  );
}
