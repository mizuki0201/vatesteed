import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Card, Empty, PageShell, Section } from "@/components/screens/page-shell";
import { NoteBody } from "@/components/screens/note-body";
import { getJockey, listJockeyRides } from "@/lib/jockeys";

export const metadata: Metadata = { title: "騎手 — Vatesteed" };

export default async function Page({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jockey = await getJockey(id);

  if (!jockey) notFound();

  const rides = await listJockeyRides(id);

  return (
    <PageShell
      back={{ href: "/jockeys", label: "騎手の一覧" }}
      lead={
        <>
          {jockey.affiliation ?? ""}
          {jockey.debutYear ? ` · ${jockey.debutYear}年デビュー` : ""}
        </>
      }
      title={jockey.name}
    >
      <Section note="1人1行の上書き（jockey_notes）" title="乗り方">
        {jockey.note ? (
          <Card>
            <NoteBody author={jockey.note.author} body={jockey.note.body} />
          </Card>
        ) : (
          <Empty>まだ評価が入っていません。</Empty>
        )}
      </Section>

      <Section note="新しい順" title="騎乗">
        {rides.length === 0 ? (
          <Empty>登録された騎乗がありません。</Empty>
        ) : (
          <ul className="space-y-2">
            {rides.map((ride) => (
              <li key={ride.entryId}>
                <Card>
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-mono text-xs text-muted-foreground">{ride.raceDate}</span>
                    <Link className="hover:underline" href={`/races/${ride.raceId}`}>
                      {ride.raceName ?? "（名前なし）"}
                    </Link>
                    <Link
                      className="font-semibold tracking-tight hover:underline"
                      href={`/horses/${ride.horseId}`}
                    >
                      {ride.horseName}
                    </Link>
                    <span className="ml-auto font-mono text-sm">
                      {ride.finishPosition ? `${ride.finishPosition}着` : "—"}
                      {ride.popularity ? ` / ${ride.popularity}番人気` : ""}
                      {ride.cornerPositions ? ` / ${ride.cornerPositions}` : ""}
                    </span>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </PageShell>
  );
}
