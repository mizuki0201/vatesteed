import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Card, Empty, PageShell, Section } from "@/components/screens/page-shell";
import { NoteBody, PedigreeNoteBody } from "@/components/screens/note-body";
import { EditMenu, type EditAction } from "@/components/screens/edit-menu";
import { HorseFields } from "@/components/screens/fact-fields";
import { Input } from "@/components/ui/input";
import {
  getHorse,
  listHorseEntries,
  nextRetirementTarget,
  RETIREMENT_TARGET_LABELS,
  retiredOnLabel,
  type HorseDetail,
} from "@/lib/horses";
import { getHorseFacts, type HorseFacts } from "@/lib/facts";
import { editHorse } from "@/app/dashboard/register/actions";
import { changeRetirement } from "./actions";

export const metadata: Metadata = { title: "馬 — Vatesteed" };

export default async function Page({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const horse = await getHorse(id);

  if (!horse) notFound();

  const [entries, facts] = await Promise.all([listHorseEntries(id), getHorseFacts(id)]);

  return (
    <PageShell
      actions={<EditMenu actions={editActions(horse, facts)} />}
      back={{ href: "/horses", label: "馬の一覧" }}
      lead={
        <>
          {horse.sex ?? ""}
          {horse.birthYear ? ` · ${horse.birthYear}年生` : ""}
          {horse.retiredAt ? ` · 引退（${retiredOnLabel(horse.retiredAt)}）` : " · 現役扱い"}
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
          <span className="mt-1 block">引退は確認できた時点で反映します。引退直後の馬は、現役扱いのことがあります。</span>
        </>
      }
      title={horse.name}
    >
      <Section note="いま時点の見立て。新しく分かったら書き換えます" title="どういう馬か">
        {horse.note ? (
          <Card>
            <NoteBody author={horse.note.author} body={horse.note.body} />
          </Card>
        ) : (
          <Empty>
            まだ書いていません。レースごとの分析が溜まってから、人と話しながら決めます。
          </Empty>
        )}
      </Section>

      <Section note="血統から読める適性の素地" title="血統">
        {horse.pedigreeNote ? (
          <Card>
            {horse.pedigreeNote.scope ? (
              <details className="mb-3 group">
                <summary className="cursor-pointer font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase list-none marker:content-none hover:text-foreground">
                  見た範囲 <span className="group-open:hidden">▸</span>
                  <span className="hidden group-open:inline">▾</span>
                </summary>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {horse.pedigreeNote.scope}
                </p>
              </details>
            ) : null}
            <PedigreeNoteBody author={horse.pedigreeNote.author} body={horse.pedigreeNote.body} />
          </Card>
        ) : (
          <Empty>
            まだ書いていません。血統そのものを登録していないので、いまは読めません。
          </Empty>
        )}
      </Section>

      <Section note="新しい順" title="出走したレース">
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
                    <p className="mt-2 text-xs text-muted-foreground">この出走についてはまだ書いていません。</p>
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

/** この画面で owner が書き換えられるもの。 */
function editActions(horse: HorseDetail, facts: HorseFacts | undefined): EditAction[] {
  const edit: EditAction[] = facts
    ? [
        {
          id: "facts",
          label: "基本情報を直す",
          title: `${horse.name}の基本情報を直す`,
          description: "父・母・所属厩舎は、登録済みのものから選びます。引退は「現役に変更」「引退に変更」で直します。",
          fields: <HorseFields defaults={facts} />,
          hidden: { horseId: horse.id },
          action: editHorse,
        },
      ]
    : [];

  // 海外の馬は現役と引退に分けていないので出さない（docs/data-model.md#horses）
  if (horse.isOverseas) return edit;

  const target = nextRetirementTarget(horse.retiredAt);
  const label = RETIREMENT_TARGET_LABELS[target];
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());

  return [
    ...edit,
    {
      id: "retirement",
      label,
      title: `${horse.name}を${label}しますか？`,
      description:
        target === "retired"
          ? "馬の一覧では「引退」に出ます。引退日が分からなければ空のままにしてください（日付不明として記録します）。"
          : "記録している引退日を消し、馬の一覧では「現役」に出ます。",
      fields:
        target === "retired" ? (
          <label className="grid gap-1.5 text-sm">
            <span>引退日（任意）</span>
            <Input max={today} min="1900-01-01" name="retiredOn" type="date" />
          </label>
        ) : undefined,
      hidden: { horseId: horse.id, target },
      action: changeRetirement,
    },
  ];
}
