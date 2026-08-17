import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Card, Empty, PageShell, Section } from "@/components/screens/page-shell";
import { NoteBody, Prose } from "@/components/screens/note-body";
import {
  formatFinishTime,
  formatSeconds,
  formatWeightDiff,
  getRace,
  listRaceBets,
  listRaceEntries,
  listRacePayouts,
  type RaceBet,
  type RaceEntry,
  type RacePayout,
} from "@/lib/races";

export const metadata: Metadata = { title: "レース — Vatesteed" };

/**
 * レースの詳細。
 *
 * **出馬表と着順を先に出す。** 見に来た人がまず知りたいのは「誰が出て、どう決まったか」で、
 * AI が何を考えたかはその次。予想の中身だけを並べると、競馬を見に来た人には読みにくい。
 */
export default async function Page({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const race = await getRace(id);

  if (!race) notFound();

  const [entries, bets, payouts] = await Promise.all([
    listRaceEntries(id),
    listRaceBets(id),
    listRacePayouts(id),
  ]);

  const byNumber = [...entries].sort(
    (a, b) => (a.horseNumber ?? 99) - (b.horseNumber ?? 99) || a.horseName.localeCompare(b.horseName),
  );
  const finished = entries
    .filter((entry) => entry.finishPosition !== null)
    .sort((a, b) => (a.finishPosition ?? 0) - (b.finishPosition ?? 0));
  const notFinished = entries.filter(
    (entry) => entry.finishPosition === null && entry.status !== "出走",
  );

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
      {finished.length > 0 ? (
        <Section title="着順">
          <ResultTable entries={finished} notFinished={notFinished} />
        </Section>
      ) : null}

      {payouts.length > 0 ? (
        <Section note="100円あたり" title="払戻">
          <PayoutTable payouts={payouts} />
        </Section>
      ) : null}

      <Section note="馬番の順" title="出馬表">
        {byNumber.length === 0 ? (
          <Empty>出走する馬がまだ登録されていません。</Empty>
        ) : (
          <EntryTable entries={byNumber} />
        )}
      </Section>

      <Section note="レース前に、隊列がどう動くかを分析したもの" title="展開の分析">
        {race.prediction ? (
          <Card>
            <NoteBody author={race.prediction.author} body={race.prediction.body} />
          </Card>
        ) : (
          <Empty>まだ書いていません。</Empty>
        )}
      </Section>

      <Section note="レース後に、レースそのものを振り返ったもの" title="レースの振り返り">
        {race.note ? (
          <Card>
            <NoteBody author={race.note.author} body={race.note.body} />
          </Card>
        ) : (
          <Empty>まだ書いていません。レースが終わったあとに書きます。</Empty>
        )}
      </Section>

      <Section note="印の順。無印は後ろ" title="1頭ずつの分析">
        {entries.length === 0 ? (
          <Empty>出走する馬がまだ登録されていません。</Empty>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li key={entry.id}>
                <EntryCard entry={entry} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section note="実際には買わず、記録だけ残しています。1レース 2,000円" title="買い目">
        {bets.length === 0 ? (
          <Empty>まだ買い目を組んでいません。</Empty>
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

/** 枠の色。JRA の枠色に合わせる。**8枠を超える色は無い。** */
const BRACKET_COLOR: Readonly<Record<number, string>> = {
  1: "bg-white text-black",
  2: "bg-black text-white border border-border",
  3: "bg-red-600 text-white",
  4: "bg-blue-600 text-white",
  5: "bg-yellow-400 text-black",
  6: "bg-green-600 text-white",
  7: "bg-orange-500 text-black",
  8: "bg-pink-400 text-black",
};

function Bracket({ number }: { readonly number: number | null }) {
  if (number === null) return <span className="text-muted-foreground">-</span>;

  return (
    <span
      className={`inline-block w-6 rounded text-center font-mono text-xs leading-5 ${
        BRACKET_COLOR[number] ?? "bg-muted"
      }`}
    >
      {number}
    </span>
  );
}

function Th({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  return (
    <th className={`border-b border-border px-2 py-2 text-left font-medium ${className ?? ""}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  className,
  title,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly title?: string;
}) {
  return (
    <td className={`border-b border-border/60 px-2 py-2 align-top ${className ?? ""}`} title={title}>
      {children}
    </td>
  );
}

/** 出馬表。走る前でも走った後でも同じものを出す。 */
function EntryTable({ entries }: { readonly entries: readonly RaceEntry[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-3xl text-sm">
        <thead>
          <tr className="text-muted-foreground">
            <Th>枠</Th>
            <Th>馬番</Th>
            <Th>印</Th>
            <Th>馬名</Th>
            <Th>性齢</Th>
            <Th>斤量</Th>
            <Th>騎手</Th>
            <Th>厩舎</Th>
            <Th className="text-right">馬体重</Th>
            <Th className="text-right">単勝</Th>
            <Th className="text-right">人気</Th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <Td>
                <Bracket number={entry.bracketNumber} />
              </Td>
              <Td className="font-mono">{entry.horseNumber ?? "-"}</Td>
              <Td title={entry.markName ?? undefined}>{entry.markSymbol ?? ""}</Td>
              <Td>
                <Link className="font-medium hover:underline" href={`/horses/${entry.horseId}`}>
                  {entry.horseName}
                </Link>
                {entry.status !== "出走" ? (
                  <span className="ml-2 rounded border border-destructive/50 px-1 text-xs text-destructive">
                    {entry.status}
                  </span>
                ) : null}
              </Td>
              <Td className="whitespace-nowrap text-muted-foreground">
                {entry.sex ?? ""}
                {entry.birthYear ? new Date().getFullYear() - entry.birthYear : ""}
              </Td>
              <Td className="font-mono">{entry.weightCarried ?? ""}</Td>
              <Td>
                {entry.jockeyId ? (
                  <Link className="hover:underline" href={`/jockeys/${entry.jockeyId}`}>
                    {entry.jockeyName}
                  </Link>
                ) : (
                  ""
                )}
              </Td>
              <Td>
                {entry.trainerId ? (
                  <Link className="hover:underline" href={`/trainers/${entry.trainerId}`}>
                    {entry.trainerName}
                  </Link>
                ) : (
                  ""
                )}
              </Td>
              <Td className="text-right font-mono whitespace-nowrap">
                {entry.bodyWeight ?? ""}
                {entry.bodyWeightDiff !== null ? (
                  <span className="ml-1 text-muted-foreground">
                    ({formatWeightDiff(entry.bodyWeightDiff)})
                  </span>
                ) : null}
              </Td>
              <Td className="text-right font-mono">{entry.winOdds ?? ""}</Td>
              <Td className="text-right font-mono">{entry.popularity ?? ""}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 着順。走らなかった馬は下に別で並べる。 */
function ResultTable({
  entries,
  notFinished,
}: {
  readonly entries: readonly RaceEntry[];
  readonly notFinished: readonly RaceEntry[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-3xl text-sm">
        <thead>
          <tr className="text-muted-foreground">
            <Th className="text-right">着</Th>
            <Th>枠</Th>
            <Th>馬番</Th>
            <Th>馬名</Th>
            <Th>騎手</Th>
            <Th className="text-right">タイム</Th>
            <Th>着差</Th>
            <Th className="text-right">上がり</Th>
            <Th>通過</Th>
            <Th className="text-right">単勝</Th>
            <Th className="text-right">人気</Th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <Td className="text-right font-mono font-semibold">{entry.finishPosition}</Td>
              <Td>
                <Bracket number={entry.bracketNumber} />
              </Td>
              <Td className="font-mono">{entry.horseNumber ?? "-"}</Td>
              <Td>
                <Link className="font-medium hover:underline" href={`/horses/${entry.horseId}`}>
                  {entry.horseName}
                </Link>
              </Td>
              <Td>{entry.jockeyName ?? ""}</Td>
              <Td className="text-right font-mono whitespace-nowrap">
                {formatFinishTime(entry.finishTimeMs)}
              </Td>
              <Td className="whitespace-nowrap">{entry.margin ?? ""}</Td>
              <Td className="text-right font-mono">{formatSeconds(entry.last3fMs)}</Td>
              <Td className="font-mono text-muted-foreground">{entry.cornerPositions ?? ""}</Td>
              <Td className="text-right font-mono">{entry.winOdds ?? ""}</Td>
              <Td className="text-right font-mono">{entry.popularity ?? ""}</Td>
            </tr>
          ))}
        </tbody>
      </table>

      {notFinished.length > 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {notFinished
            .map((entry) => `${entry.horseNumber ?? "-"} ${entry.horseName}（${entry.status}）`)
            .join(" / ")}
        </p>
      ) : null}
    </div>
  );
}

/** 確定払戻。 */
function PayoutTable({ payouts }: { readonly payouts: readonly RacePayout[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-md text-sm">
        <thead>
          <tr className="text-muted-foreground">
            <Th>券種</Th>
            <Th>組み合わせ</Th>
            <Th className="text-right">払戻</Th>
            <Th className="text-right">人気</Th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((payout) => (
            <tr key={`${payout.ticketType}-${payout.combination}`}>
              <Td>{payout.ticketType}</Td>
              <Td className="font-mono">{payout.combination}</Td>
              <Td className="text-right font-mono">{payout.amount.toLocaleString()}円</Td>
              <Td className="text-right font-mono text-muted-foreground">
                {payout.popularity ?? ""}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 1頭ずつの分析。長い本文は畳んでおく。 */
function EntryCard({ entry }: { readonly entry: RaceEntry }) {
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
        <Link
          className="text-base font-semibold tracking-tight hover:underline"
          href={`/horses/${entry.horseId}`}
        >
          {entry.horseName}
        </Link>
        <span className="text-xs text-muted-foreground">
          {entry.jockeyName ?? ""}
          {entry.trainerName ? ` · ${entry.trainerName}` : ""}
        </span>
        {entry.finishPosition ? (
          <span className="ml-auto font-mono text-sm">{entry.finishPosition}着</span>
        ) : null}
      </div>

      {entry.rationale ? (
        <div className="mt-3 border-l-2 border-border pl-3">
          <Prose>{entry.rationale}</Prose>
        </div>
      ) : null}

      {/*
        本文は1頭で数千字あるので既定では畳む。16頭ぶんを開いたまま並べると1画面に収まらず、
        印と理由を見比べられない。JavaScript を使わずに details で畳む。
      */}
      {entry.horseNote ? (
        <Foldable label="この馬について">
          <NoteBody author={entry.horseNoteAuthor ?? "AI"} body={entry.horseNote} />
        </Foldable>
      ) : null}

      {entry.entryNote ? (
        <Foldable label="このレースでの走りについて">
          <NoteBody author={entry.entryNoteAuthor ?? "AI"} body={entry.entryNote} />
        </Foldable>
      ) : null}
    </Card>
  );
}

/** 長い本文を畳む。開いた状態は画面のリロードで戻る（覚えさせていない）。 */
function Foldable({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <details className="mt-3 border-t border-border/60 pt-2">
      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
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
        <p className="mt-2 text-xs text-muted-foreground">まだ結果が出ていません。</p>
      )}
    </Card>
  );
}
