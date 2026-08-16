import { query } from "../db/index.ts";
import { assertCan } from "../access/index.ts";

/**
 * 蓄積された評価の横断一覧。
 *
 * 7つの評価テーブルは対象が違うだけで形が同じなので、**対象の名前を付けて縦に並べる**。
 * 「古い評価が今も生きているか」を見るための画面なので、既定では更新の新しい順。
 */

export const NOTE_KINDS = [
  "entry",
  "horse",
  "pedigree",
  "jockey",
  "trainer",
  "course",
  "race",
] as const;

export type NoteKind = (typeof NOTE_KINDS)[number];

/** 画面に出す日本語のラベル。 */
export const NOTE_KIND_LABEL: Readonly<Record<NoteKind, string>> = {
  entry: "出走",
  horse: "馬",
  pedigree: "血統",
  jockey: "騎手",
  trainer: "厩舎",
  course: "コース",
  race: "レース",
};

/**
 * `updated_at` は時間帯を持つ型なので、DB から `Date` として返る。
 *
 * **そのまま文字列にすると `Sun Aug 16 2026 ...` になる**ので、日付だけを日本時間で出す。
 * 画面で見たいのは「いつ時点の評価か」であって時刻ではない。
 */
function toDateText(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(date);
}

export type NoteRow = {
  readonly kind: NoteKind;
  readonly subject: string;
  readonly body: string;
  readonly author: string;
  /** `2026-08-16` の形。日本時間の日付。 */
  readonly updatedAt: string;
  /** その評価の対象を開く画面。無いものは `null`。 */
  readonly href: string | null;
};

/**
 * 7種類をまとめて引く。
 *
 * `entry_notes` の対象は「どのレースのどの馬か」なので、レース名と馬名を組み立てて出す。
 */
export async function listNotes(
  options: { readonly q?: string; readonly kind?: NoteKind } = {},
): Promise<readonly NoteRow[]> {
  await assertCan("notes.raw");

  const q = options.q?.trim();
  const kind = options.kind;

  const { rows } = await query(
    `WITH all_notes AS (
       SELECT 'entry' AS kind,
              h.name || '（' || coalesce(r.race_name, r.race_date::text) || '）' AS subject,
              n.body, n.author, n.updated_at,
              '/races/' || r.id AS href
         FROM entry_notes n
         JOIN entries e ON e.id = n.entry_id
         JOIN horses h ON h.id = e.horse_id
         JOIN races r ON r.id = e.race_id
       UNION ALL
       SELECT 'horse', h.name, n.body, n.author, n.updated_at, '/horses/' || h.id
         FROM horse_notes n JOIN horses h ON h.id = n.horse_id
       UNION ALL
       SELECT 'pedigree', h.name, n.body, n.author, n.updated_at, '/horses/' || h.id
         FROM pedigree_notes n JOIN horses h ON h.id = n.horse_id
       UNION ALL
       SELECT 'jockey', j.name, n.body, n.author, n.updated_at, '/jockeys/' || j.id
         FROM jockey_notes n JOIN jockeys j ON j.id = n.jockey_id
       UNION ALL
       SELECT 'trainer', t.name, n.body, n.author, n.updated_at, '/trainers/' || t.id
         FROM trainer_notes n JOIN trainers t ON t.id = n.trainer_id
       UNION ALL
       SELECT 'course', c.track || ' ' || c.surface || c.distance_m || 'm',
              n.body, n.author, n.updated_at, '/courses/' || c.id
         FROM course_notes n JOIN courses c ON c.id = n.course_id
       UNION ALL
       SELECT 'race', coalesce(r.race_name, r.race_date::text), n.body, n.author, n.updated_at,
              '/races/' || r.id
         FROM race_notes n JOIN races r ON r.id = n.race_id
     )
     SELECT kind, subject, body, author, updated_at, href
       FROM all_notes
      WHERE ($1::text IS NULL OR subject ILIKE '%' || $1 || '%' OR body ILIKE '%' || $1 || '%')
        AND ($2::text IS NULL OR kind = $2)
      ORDER BY updated_at DESC
      LIMIT 300`,
    [q || null, kind ?? null],
  );

  return rows.map((row) => ({
    kind: row.kind as NoteKind,
    subject: String(row.subject),
    body: String(row.body),
    author: String(row.author),
    updatedAt: toDateText(row.updated_at),
    href: (row.href as string | null) ?? null,
  }));
}

/** 種類ごとの件数。画面の絞り込みに出す。 */
export async function countNotesByKind(): Promise<Readonly<Record<NoteKind, number>>> {
  await assertCan("notes.raw");

  const { rows } = await query(
    `SELECT 'entry' AS kind, count(*) AS count FROM entry_notes
     UNION ALL SELECT 'horse', count(*) FROM horse_notes
     UNION ALL SELECT 'pedigree', count(*) FROM pedigree_notes
     UNION ALL SELECT 'jockey', count(*) FROM jockey_notes
     UNION ALL SELECT 'trainer', count(*) FROM trainer_notes
     UNION ALL SELECT 'course', count(*) FROM course_notes
     UNION ALL SELECT 'race', count(*) FROM race_notes`,
  );

  const counts = Object.fromEntries(NOTE_KINDS.map((kind) => [kind, 0])) as Record<NoteKind, number>;

  for (const row of rows) counts[row.kind as NoteKind] = Number(row.count);

  return counts;
}
