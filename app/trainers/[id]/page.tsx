import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Card, Empty, PageShell, Section } from "@/components/screens/page-shell";
import { NoteBody } from "@/components/screens/note-body";
import { getTrainer, listTrainerHorses } from "@/lib/trainers";

export const metadata: Metadata = { title: "厩舎 — Vatesteed" };

export default async function Page({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trainer = await getTrainer(id);

  if (!trainer) notFound();

  const horses = await listTrainerHorses(id);

  return (
    <PageShell
      back={{ href: "/trainers", label: "厩舎の一覧" }}
      lead={trainer.affiliation ?? undefined}
      title={trainer.name}
    >
      <Section note="いま時点の見立て。新しく分かったら書き換えます" title="仕上げ方とローテーション">
        {trainer.note ? (
          <Card>
            <NoteBody author={trainer.note.author} body={trainer.note.body} />
          </Card>
        ) : (
          <Empty>まだ書いていません。</Empty>
        )}
      </Section>

      <Section note="いまこの厩舎にいる馬。転厩した馬は移った先に出ます" title="管理馬">
        {horses.length === 0 ? (
          <Empty>まだ登録されていません。</Empty>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {horses.map((horse) => (
              <li key={horse.id}>
                <Link href={`/horses/${horse.id}`}>
                  <Card className="h-full transition-colors hover:border-foreground/30">
                    <span className="font-semibold tracking-tight">{horse.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {horse.sex ?? ""}
                      {horse.birthYear ? ` ${horse.birthYear}年生` : ""}
                    </span>
                    {horse.lastRaceDate ? (
                      <p className="mt-1 font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
                        最後の出走 {horse.lastRaceDate}
                      </p>
                    ) : null}
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
