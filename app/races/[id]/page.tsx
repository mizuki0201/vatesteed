import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Card, Empty, PageShell, Section } from "@/components/screens/page-shell";
import { NoteBody, Prose } from "@/components/screens/note-body";
import { getRace, listRaceBets, listRaceEntries, type RaceBet, type RaceEntry } from "@/lib/races";

export const metadata: Metadata = { title: "レース — Vatesteed" };

/**
 * レース1枚。**このレースについて DB にあるものを、1画面に全部出す。**
 *
 * 予想（走る前）と評価（走ったあと）を同じ画面に並べているので、振り返りのときに突き合わせ
 * られる。
 */
export default async function Page({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const race = await getRace(id);

  if (!race) notFound();

  const [entries, bets] = await Promise.all([listRaceEntries(id), listRaceBets(id)]);
  const hasResult = entries.some((entry) => entry.finishPosition !== null);

  return (
    <PageShell
      back={{ href: "/races", label: "レース一覧" }}
      lead={
        <>
          {race.raceDate} · {race.track} {race.surface}
          {race.distanceM}m {race.turn}回り{race.layout ? `（${race.layout}）` : ""} ·{" "}
          {entries.length}頭
          {race.trackCondition ? ` · 馬場 ${race.trackCondition}` : ""}
          {race.weather ? ` · ${race.weather}` : ""}
          {race.weatherForecast && !race.weather ? ` · 予報 ${race.weatherForecast}` : ""}
          {race.weightRule ? ` · ${race.weightRule}` : ""}
        </>
      }
      title={`${race.raceName ?? "（名前なし）"}${race.grade ? `（${race.grade}）` : ""}`}
    >
      <Section
        note="走る前に組んだ隊列の見立て（race_predictions）"
        title="展開の予想"
      >
        {race.prediction ? (
          <Card>
            <NoteBody author={race.prediction.author} body={race.prediction.body} />
          </Card>
        ) : (
          <Empty>まだ展開の予想が入っていません。</Empty>
        )}
      </Section>

      <Section note="走ったあとの評価（race_notes）" title="レースの評価">
        {race.note ? (
          <Card>
            <NoteBody author={race.note.author} body={race.note.body} />
          </Card>
        ) : (
          <Empty>
            まだレースの評価が入っていません。振り返り（review-race）で埋まります。
          </Empty>
        )}
      </Section>

      <Section note="印の順。無印は後ろ" title="出走馬">
        {entries.length === 0 ? (
          <Empty>出走が登録されていません。</Empty>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li key={entry.id}>
                <EntryCard entry={entry} hasResult={hasResult} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section note="1レースの予算は 2,000円で固定" title="買い目">
        {bets.length === 0 ? (
          <Empty>まだ買い目が入っていません。</Empty>
        ) : (
          <div className="space-y-2">
            {bets.map((bet) => (
              <BetCard bet={bet} key={bet.id} />
            ))}
            <p className="text-sm text-muted-foreground">
              合計 {bets.reduce((sum, bet) => sum + bet.totalAmount, 0).toLocaleString()} 円 ／{" "}
              {bets.reduce((sum, bet) => sum + bet.combinationCount, 0)} 点
            </p>
          </div>
        )}
      </Section>
    </PageShell>
  );
}

function EntryCard({
  entry,
  hasResult,
}: {
  readonly entry: RaceEntry;
  readonly hasResult: boolean;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="w-8 text-center font-mono text-sm text-muted-foreground">
          {entry.horseNumber ?? "-"}
        </span>
        {entry.markSymbol ? (
          <span className="text-lg leading-none" title={entry.markName ?? undefined}>
            {entry.markSymbol}
          </span>
        ) : null}
        <Link className="text-base font-semibold tracking-tight hover:underline" href={`/horses/${entry.horseId}`}>
          {entry.horseName}
        </Link>
        <span className="text-xs text-muted-foreground">
          {entry.sex ?? ""}
          {entry.birthYear ? `${new Date().getFullYear() - entry.birthYear}` : ""}
        </span>
        {entry.jockeyId ? (
          <Link className="text-sm text-muted-foreground hover:underline" href={`/jockeys/${entry.jockeyId}`}>
            {entry.jockeyName}
          </Link>
        ) : null}
        {entry.trainerId ? (
          <Link className="text-sm text-muted-foreground hover:underline" href={`/trainers/${entry.trainerId}`}>
            {entry.trainerName}
          </Link>
        ) : null}
        {entry.weightCarried ? (
          <span className="text-sm text-muted-foreground">{entry.weightCarried}kg</span>
        ) : null}
        {entry.status !== "出走" ? (
          <span className="rounded border border-destructive/50 px-1.5 py-0.5 text-xs text-destructive">
            {entry.status}
          </span>
        ) : null}

        {hasResult ? (
          <span className="ml-auto font-mono text-sm">
            {entry.finishPosition ? `${entry.finishPosition}着` : "—"}
            {entry.popularity ? ` / ${entry.popularity}番人気` : ""}
            {entry.cornerPositions ? ` / ${entry.cornerPositions}` : ""}
          </span>
        ) : null}
      </div>

      {entry.rationale ? (
        <div className="mt-3 border-l-2 border-border pl-3">
          <Prose>{entry.rationale}</Prose>
        </div>
      ) : null}

      {/*
        評価の本文は1頭で数千字あるので、既定では畳んでおく。16頭ぶんを開いたまま並べると
        1画面に収まらず、印と理由を見比べられない。JavaScript を使わずに details で畳む。
      */}
      {entry.horseNote ? (
        <Foldable label="どういう馬か">
          <NoteBody author={entry.horseNoteAuthor ?? "AI"} body={entry.horseNote} />
        </Foldable>
      ) : null}

      {entry.entryNote ? (
        <Foldable label="この出走について">
          <NoteBody author={entry.entryNoteAuthor ?? "AI"} body={entry.entryNote} />
        </Foldable>
      ) : null}
    </Card>
  );
}

/** 長い本文を畳む。開いた状態は画面のリロードで戻る（覚えさせていない）。 */
function Foldable({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <details className="mt-3 border-t border-border/60 pt-2">
      <summary className="cursor-pointer font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase hover:text-foreground">
        {label}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

function BetCard({ bet }: { readonly bet: RaceBet }) {
  const groups = [...new Set(bet.legs.map((leg) => leg.legGroup))].sort((a, b) => a - b);

  return (
    <Card>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="font-semibold">{bet.ticketType}</span>
        <span className="text-sm text-muted-foreground">
          {bet.betStyle}
          {bet.isMulti ? "・マルチ" : ""}
        </span>
        <span className="ml-auto font-mono text-sm">
          {bet.combinationCount}点 × {bet.unitAmount}円 = {bet.totalAmount.toLocaleString()}円
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {groups.map((group) => (
          <span key={group}>
            <span className="mr-1 font-mono text-xs text-muted-foreground">{group}列</span>
            {bet.legs
              .filter((leg) => leg.legGroup === group)
              .map((leg) => leg.horseNumber ?? `${leg.bracketNumber}枠`)
              .join(", ")}
          </span>
        ))}
      </div>

      {bet.payout !== null || bet.refund !== null ? (
        <p className="mt-2 font-mono text-sm">
          払戻 {(bet.payout ?? 0).toLocaleString()}円
          {bet.refund ? ` / 返還 ${bet.refund.toLocaleString()}円` : ""}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">結果はまだ入っていません。</p>
      )}
    </Card>
  );
}
