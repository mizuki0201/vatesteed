import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { editJockey } from "@/app/dashboard/register/actions";
import { EditMenu, type EditAction } from "@/components/screens/edit-menu";
import { JockeyFields } from "@/components/screens/fact-fields";
import { getJockeyFacts, type JockeyFacts } from "@/lib/facts";
import { Card, Empty, PageShell, Section } from "@/components/screens/page-shell";
import { NoteBody } from "@/components/screens/note-body";
import { getJockey, listJockeyRides } from "@/lib/jockeys";

export const metadata: Metadata = { title: "騎手 — Vatesteed" };

export default async function Page({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jockey = await getJockey(id);

  if (!jockey) notFound();

  const [rides, facts] = await Promise.all([listJockeyRides(id), getJockeyFacts(id)]);

  return (
    <PageShell
      actions={<EditMenu actions={editActions(facts)} />}
      back={{ href: "/jockeys", label: "騎手の一覧" }}
      lead={
        <>
          {jockey.affiliation ?? ""}
          {jockey.debutYear ? ` · ${jockey.debutYear}年デビュー` : ""}
        </>
      }
      title={jockey.name}
    >
      <Section note="いま時点の見立て。新しく分かったら書き換えます" title="乗り方">
        {jockey.note ? (
          <Card>
            <NoteBody author={jockey.note.author} body={jockey.note.body} />
          </Card>
        ) : (
          <Empty>まだ書いていません。</Empty>
        )}
      </Section>

      <Section note="新しい順" title="乗ったレース">
        {rides.length === 0 ? (
          <Empty>まだ登録されていません。</Empty>
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

/** owner にだけ出す、直す項目。 */
function editActions(facts: JockeyFacts | undefined): EditAction[] {
  if (!facts) return [];

  return [
    {
      id: "facts",
      label: "基本情報を直す",
      title: `${facts.name}の基本情報を直す`,
      description: "名前・生年・デビュー年・所属を直します。",
      fields: <JockeyFields defaults={facts} />,
      hidden: { jockeyId: facts.id },
      action: editJockey,
    },
  ];
}
