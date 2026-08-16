import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Card, Empty, PageShell, Section } from "@/components/screens/page-shell";
import { NoteBody } from "@/components/screens/note-body";
import { getHorse, listHorseEntries } from "@/lib/horses";

export const metadata: Metadata = { title: "馬 — Vatesteed" };

export default async function Page({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const horse = await getHorse(id);

  if (!horse) notFound();

  const entries = await listHorseEntries(id);

  return (
    <PageShell
      back={{ href: "/horses", label: "馬の一覧" }}
      lead={
        <>
          {horse.sex ?? ""}
          {horse.birthYear ? ` · ${horse.birthYear}年生` : ""}
          {horse.trainerId ? (
            <>
              {" · "}
              <Link className="underline hover:no-underline" href={`/trainers/${horse.trainerId}`}>
                {horse.trainerName}
              </Link>
            </>
          ) : null}
          {horse.sireName || horse.damName
            ? ` · 父 ${horse.sireName ?? "不明"} / 母 ${horse.damName ?? "不明"}`
            : ""}
        </>
      }
      title={horse.name}
    >
      <Section note="1頭1行の上書き（horse_notes）" title="どういう馬か">
        {horse.note ? (
          <Card>
            <NoteBody author={horse.note.author} body={horse.note.body} />
          </Card>
        ) : (
          <Empty>
            まだ評価が入っていません。出走ごとの読みが溜まってから、対話で作ります。
          </Empty>
        )}
      </Section>

      <Section note="pedigree_notes" title="血統">
        {horse.pedigreeNote ? (
          <Card>
            {horse.pedigreeNote.scope ? (
              <p className="mb-2 font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
                見た範囲: {horse.pedigreeNote.scope}
              </p>
            ) : null}
            <NoteBody author={horse.pedigreeNote.author} body={horse.pedigreeNote.body} />
          </Card>
        ) : (
          <Empty>
            血統の評価はまだありません。血統そのものが DB に入っていないため、いまは読めません。
          </Empty>
        )}
      </Section>

      <Section note="新しい順（entry_notes）" title="出走">
        {entries.length === 0 ? (
          <Empty>出走が登録されていません。</Empty>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Card>
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-mono text-xs text-muted-foreground">
                      {entry.raceDate}
                    </span>
                    <Link
                      className="font-semibold tracking-tight hover:underline"
                      href={`/races/${entry.raceId}`}
                    >
                      {entry.raceName ?? "（名前なし）"}
                    </Link>
                    {entry.grade ? (
                      <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">
                        {entry.grade}
                      </span>
                    ) : null}
                    <span className="text-sm text-muted-foreground">
                      {entry.track} {entry.surface}
                      {entry.distanceM}m
                      {entry.jockeyName ? ` · ${entry.jockeyName}` : ""}
                    </span>
                    <span className="ml-auto font-mono text-sm">
                      {entry.finishPosition ? `${entry.finishPosition}着` : entry.status}
                      {entry.popularity ? ` / ${entry.popularity}番人気` : ""}
                      {entry.cornerPositions ? ` / ${entry.cornerPositions}` : ""}
                    </span>
                  </div>
                  {entry.note ? (
                    <div className="mt-3">
                      <NoteBody author={entry.noteAuthor ?? "AI"} body={entry.note} />
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">この出走の読みはまだです。</p>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </PageShell>
  );
}
