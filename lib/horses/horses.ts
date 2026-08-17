import { query } from "../db/index.ts";
import { assertCan } from "../access/index.ts";

/** 馬の画面が読むもの。 */

export type HorseSummary = {
  readonly id: string;
  readonly name: string;
  readonly sex: string | null;
  readonly birthYear: number | null;
  readonly trainerName: string | null;
  readonly entryCount: string;
  readonly hasNote: boolean;
  readonly retiredAt: string | null;
};

export type HorseDetail = {
  readonly id: string;
  readonly name: string;
  readonly nameKana: string | null;
  readonly sex: string | null;
  readonly birthYear: number | null;
  readonly trainerId: string | null;
  readonly trainerName: string | null;
  readonly retiredAt: string | null;
  readonly sireName: string | null;
  readonly damName: string | null;
  readonly note: { readonly body: string; readonly author: string } | null;
  readonly pedigreeNote: {
    readonly body: string;
    readonly author: string;
    readonly scope: string | null;
  } | null;
};

export type HorseEntry = {
  readonly id: string;
  readonly raceId: string;
  readonly raceDate: string;
  readonly raceName: string | null;
  readonly grade: string | null;
  readonly track: string;
  readonly surface: string;
  readonly distanceM: number;
  readonly finishPosition: number | null;
  readonly popularity: number | null;
  readonly status: string;
  readonly jockeyName: string | null;
  readonly cornerPositions: string | null;
  readonly note: string | null;
  readonly noteAuthor: string | null;
};

export type HorseStatus = "active" | "retired";

/** 一覧。`q` を渡すと馬名の部分一致で絞る。現役を既定にする。 */
export async function listHorses(options: { readonly q?: string; readonly status?: HorseStatus } = {}): Promise<
  readonly HorseSummary[]
> {
  await assertCan("horses");

  const q = options.q?.trim();
  const status = options.status ?? "active";

  const { rows } = await query(
    `SELECT h.id, h.name, h.sex, h.birth_year, h.retired_at, t.name AS trainer_name,
            (SELECT count(*) FROM entries e WHERE e.horse_id = h.id) AS entry_count,
            EXISTS (SELECT 1 FROM horse_notes n WHERE n.horse_id = h.id) AS has_note
       FROM horses h
       LEFT JOIN trainers t ON t.id = h.trainer_id
      WHERE ($1::text IS NULL OR h.name ILIKE '%' || $1 || '%')
        AND (CASE WHEN $2 = 'retired' THEN h.retired_at IS NOT NULL ELSE h.retired_at IS NULL END)
      ORDER BY h.name
      LIMIT 200`,
    [q || null, status],
  );

  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    sex: (row.sex as string | null) ?? null,
    birthYear: (row.birth_year as number | null) ?? null,
    trainerName: (row.trainer_name as string | null) ?? null,
    entryCount: String(row.entry_count),
    hasNote: Boolean(row.has_note),
    retiredAt: (row.retired_at as string | null) ?? null,
  }));
}

export async function getHorse(id: string): Promise<HorseDetail | undefined> {
  await assertCan("horses");

  const { rows } = await query(
    `SELECT h.id, h.name, h.name_kana, h.sex, h.birth_year, h.retired_at,
            t.id AS trainer_id, t.name AS trainer_name,
            sire.name AS sire_name, dam.name AS dam_name,
            n.body AS note_body, n.author AS note_author,
            p.body AS pedigree_body, p.author AS pedigree_author, p.scope AS pedigree_scope
       FROM horses h
       LEFT JOIN trainers t ON t.id = h.trainer_id
       LEFT JOIN horses sire ON sire.id = h.sire_id
       LEFT JOIN horses dam ON dam.id = h.dam_id
       LEFT JOIN horse_notes n ON n.horse_id = h.id
       LEFT JOIN pedigree_notes p ON p.horse_id = h.id
      WHERE h.id = $1`,
    [id],
  );

  const row = rows[0];
  if (!row) return undefined;

  return {
    id: String(row.id),
    name: String(row.name),
    nameKana: (row.name_kana as string | null) ?? null,
    sex: (row.sex as string | null) ?? null,
    birthYear: (row.birth_year as number | null) ?? null,
    trainerId: row.trainer_id === null ? null : String(row.trainer_id),
    trainerName: (row.trainer_name as string | null) ?? null,
    retiredAt: (row.retired_at as string | null) ?? null,
    sireName: (row.sire_name as string | null) ?? null,
    damName: (row.dam_name as string | null) ?? null,
    note: row.note_body ? { body: String(row.note_body), author: String(row.note_author) } : null,
    pedigreeNote: row.pedigree_body
      ? {
          body: String(row.pedigree_body),
          author: String(row.pedigree_author),
          scope: (row.pedigree_scope as string | null) ?? null,
        }
      : null,
  };
}

/** その馬の出走を、新しい順に。 */
export async function listHorseEntries(horseId: string): Promise<readonly HorseEntry[]> {
  await assertCan("horses");

  const { rows } = await query(
    `SELECT e.id, e.status, e.finish_position, e.popularity, e.corner_positions,
            r.id AS race_id, r.race_date, r.race_name, r.grade,
            c.track, c.surface, c.distance_m,
            j.name AS jockey_name,
            n.body AS note_body, n.author AS note_author
       FROM entries e
       JOIN races r ON r.id = e.race_id
       JOIN courses c ON c.id = r.course_id
       LEFT JOIN jockeys j ON j.id = e.jockey_id
       LEFT JOIN entry_notes n ON n.entry_id = e.id
      WHERE e.horse_id = $1
      ORDER BY r.race_date DESC`,
    [horseId],
  );

  return rows.map((row) => ({
    id: String(row.id),
    raceId: String(row.race_id),
    raceDate: String(row.race_date),
    raceName: (row.race_name as string | null) ?? null,
    grade: (row.grade as string | null) ?? null,
    track: String(row.track),
    surface: String(row.surface),
    distanceM: Number(row.distance_m),
    finishPosition: (row.finish_position as number | null) ?? null,
    popularity: (row.popularity as number | null) ?? null,
    status: String(row.status),
    jockeyName: (row.jockey_name as string | null) ?? null,
    cornerPositions: (row.corner_positions as string | null) ?? null,
    note: (row.note_body as string | null) ?? null,
    noteAuthor: (row.note_author as string | null) ?? null,
  }));
}
