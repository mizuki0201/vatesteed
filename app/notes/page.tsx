import Link from "next/link";
import type { Metadata } from "next";
import { Card, Empty, PageShell } from "@/components/screens/page-shell";
import { NoteBody } from "@/components/screens/note-body";
import { SearchForm } from "@/components/screens/search-form";
import { countNotesByKind, listNotes, NOTE_KINDS, NOTE_KIND_LABEL, type NoteKind } from "@/lib/notes";

export const metadata: Metadata = { title: "書きためた読み — Vatesteed" };

/**
 * 書きためた読みを、対象をまたいで1つの並びで見る画面。
 *
 * **更新の新しい順**にしてあるのは、「昔の見立てが今も通用するか」を見つけるため。
 */
export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string; readonly kind?: string }>;
}) {
  const { q, kind } = await searchParams;
  const selected = NOTE_KINDS.find((value) => value === kind);

  const [notes, counts] = await Promise.all([
    listNotes({ q, kind: selected }),
    countNotesByKind(),
  ]);

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return (
    <PageShell
      actions={<SearchForm action="/notes" defaultValue={q} placeholder="対象名・本文" />}
      lead={`${total} 件。新しく書いたものから並べています。`}
      title="書きためた読み"
    >
      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        <FilterLink count={total} current={selected} kind={undefined} q={q} />
        {NOTE_KINDS.map((value) => (
          <FilterLink count={counts[value]} current={selected} key={value} kind={value} q={q} />
        ))}
      </div>

      {notes.length === 0 ? (
        <Empty>
          {q ? `「${q}」に当たるものはありません。` : "まだ何も書いていません。"}
        </Empty>
      ) : (
        <ul className="space-y-2">
          {notes.map((note, index) => (
            <li key={`${note.kind}-${note.subject}-${index}`}>
              <Card>
                <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
                  <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">
                    {NOTE_KIND_LABEL[note.kind]}
                  </span>
                  {note.href ? (
                    <Link className="font-semibold tracking-tight hover:underline" href={note.href}>
                      {note.subject}
                    </Link>
                  ) : (
                    <span className="font-semibold tracking-tight">{note.subject}</span>
                  )}
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {note.updatedAt}
                  </span>
                </div>
                <NoteBody author={note.author} body={note.body} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}

function FilterLink({
  kind,
  current,
  count,
  q,
}: {
  readonly kind: NoteKind | undefined;
  readonly current: NoteKind | undefined;
  readonly count: number;
  readonly q: string | undefined;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (kind) params.set("kind", kind);

  const query = params.toString();
  const isCurrent = kind === current;

  return (
    <Link
      className={
        isCurrent
          ? "rounded-full border border-foreground/40 px-3 py-1"
          : "rounded-full border border-border px-3 py-1 text-muted-foreground hover:text-foreground"
      }
      href={query ? `/notes?${query}` : "/notes"}
    >
      {kind ? NOTE_KIND_LABEL[kind] : "すべて"} {count}
    </Link>
  );
}
