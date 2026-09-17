import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EntryRacePicker, EntrySheetForm } from "@/components/screens/entry-sheet-form";
import { PageShell, Section } from "@/components/screens/page-shell";
import { assertCan } from "@/lib/access";
import { getEntrySheet } from "@/lib/facts";

export const metadata: Metadata = { title: "出走を登録する — Vatesteed" };

/**
 * レースを1つ選んで、そのレースの出走を入れる・直す。
 *
 * **馬・騎手・レースは先に登録してある前提**で、ここでは選ぶだけ（docs/product.md#画面）。
 */
export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly race?: string }>;
}) {
  await assertCan("data.edit");

  const { race } = await searchParams;
  const back = { href: "/dashboard/register", label: "データを登録する" };

  if (!race) {
    return (
      <PageShell back={back} lead="出走を入れるレースを選んでください。" title="出走を登録する">
        <EntryRacePicker />
      </PageShell>
    );
  }

  const sheet = /^[1-9][0-9]*$/.test(race) ? await getEntrySheet(race) : undefined;

  if (!sheet) notFound();

  return (
    <PageShell
      back={back}
      lead={
        <>
          <Link className="underline hover:no-underline" href={`/races/${sheet.race.id}`}>
            {sheet.race.label}
          </Link>
          <span className="mt-1 block">
            馬と騎手は、登録済みのものから選びます。厩舎は、保存するときに馬の所属厩舎を入れます。
          </span>
        </>
      }
      title="出走を登録する"
    >
      <Section title="出走">
        <EntrySheetForm
          entryListComplete={sheet.entryListComplete}
          raceId={sheet.race.id}
          rows={sheet.rows.map((row) => ({
            entryId: row.entryId,
            horse: row.horse,
            jockey: row.jockey,
            bracketNumber: row.bracketNumber === null ? "" : String(row.bracketNumber),
            horseNumber: row.horseNumber === null ? "" : String(row.horseNumber),
            weightCarried: row.weightCarried ?? "",
            status: row.status,
            removable: row.removable,
          }))}
        />
      </Section>

      <p className="mt-6 text-sm">
        <Link className="text-muted-foreground underline hover:text-foreground" href="/dashboard/register/entry">
          別のレースを選ぶ
        </Link>
      </p>
    </PageShell>
  );
}
