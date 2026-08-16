import { query } from "../db/index.ts";
import { assertCan } from "../access/index.ts";

/** 厩舎の画面が読むもの。 */

export type TrainerSummary = {
  readonly id: string;
  readonly name: string;
  readonly affiliation: string | null;
  readonly horseCount: string;
  readonly hasNote: boolean;
};

export type TrainerDetail = {
  readonly id: string;
  readonly name: string;
  readonly nameKana: string | null;
  readonly affiliation: string | null;
  readonly openedOn: string | null;
  readonly note: { readonly body: string; readonly author: string } | null;
};

export type TrainerHorse = {
  readonly id: string;
  readonly name: string;
  readonly sex: string | null;
  readonly birthYear: number | null;
  readonly lastRaceDate: string | null;
};

export async function listTrainers(options: { readonly q?: string } = {}): Promise<
  readonly TrainerSummary[]
> {
  await assertCan("trainers");

  const q = options.q?.trim();

  const { rows } = await query(
    `SELECT t.id, t.name, t.affiliation,
            (SELECT count(*) FROM horses h WHERE h.trainer_id = t.id) AS horse_count,
            EXISTS (SELECT 1 FROM trainer_notes n WHERE n.trainer_id = t.id) AS has_note
       FROM trainers t
      WHERE $1::text IS NULL OR t.name ILIKE '%' || $1 || '%'
      ORDER BY t.name
      LIMIT 200`,
    [q || null],
  );

  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    affiliation: (row.affiliation as string | null) ?? null,
    horseCount: String(row.horse_count),
    hasNote: Boolean(row.has_note),
  }));
}

export async function getTrainer(id: string): Promise<TrainerDetail | undefined> {
  await assertCan("trainers");

  const { rows } = await query(
    `SELECT t.id, t.name, t.name_kana, t.affiliation, t.opened_on,
            n.body AS note_body, n.author AS note_author
       FROM trainers t
       LEFT JOIN trainer_notes n ON n.trainer_id = t.id
      WHERE t.id = $1`,
    [id],
  );

  const row = rows[0];
  if (!row) return undefined;

  return {
    id: String(row.id),
    name: String(row.name),
    nameKana: (row.name_kana as string | null) ?? null,
    affiliation: (row.affiliation as string | null) ?? null,
    openedOn: row.opened_on === null ? null : String(row.opened_on),
    note: row.note_body ? { body: String(row.note_body), author: String(row.note_author) } : null,
  };
}

/** その厩舎の管理馬。**出走の `trainer_id` ではなく、馬の現在の所属で引く。** */
export async function listTrainerHorses(trainerId: string): Promise<readonly TrainerHorse[]> {
  await assertCan("trainers");

  const { rows } = await query(
    `SELECT h.id, h.name, h.sex, h.birth_year,
            (SELECT max(r.race_date) FROM entries e JOIN races r ON r.id = e.race_id
              WHERE e.horse_id = h.id) AS last_race_date
       FROM horses h
      WHERE h.trainer_id = $1
      ORDER BY h.name`,
    [trainerId],
  );

  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    sex: (row.sex as string | null) ?? null,
    birthYear: (row.birth_year as number | null) ?? null,
    lastRaceDate: row.last_race_date === null ? null : String(row.last_race_date),
  }));
}
