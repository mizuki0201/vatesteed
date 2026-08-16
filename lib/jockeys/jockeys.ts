import { query } from "../db/index.ts";
import { assertCan } from "../access/index.ts";

/** 騎手の画面が読むもの。 */

export type JockeySummary = {
  readonly id: string;
  readonly name: string;
  readonly affiliation: string | null;
  readonly rideCount: string;
  readonly hasNote: boolean;
};

export type JockeyDetail = {
  readonly id: string;
  readonly name: string;
  readonly nameKana: string | null;
  readonly affiliation: string | null;
  readonly birthYear: number | null;
  readonly debutYear: number | null;
  readonly note: { readonly body: string; readonly author: string } | null;
};

export type JockeyRide = {
  readonly entryId: string;
  readonly raceId: string;
  readonly raceDate: string;
  readonly raceName: string | null;
  readonly horseId: string;
  readonly horseName: string;
  readonly finishPosition: number | null;
  readonly popularity: number | null;
  readonly cornerPositions: string | null;
};

export async function listJockeys(options: { readonly q?: string } = {}): Promise<
  readonly JockeySummary[]
> {
  await assertCan("jockeys");

  const q = options.q?.trim();

  const { rows } = await query(
    `SELECT j.id, j.name, j.affiliation,
            (SELECT count(*) FROM entries e WHERE e.jockey_id = j.id) AS ride_count,
            EXISTS (SELECT 1 FROM jockey_notes n WHERE n.jockey_id = j.id) AS has_note
       FROM jockeys j
      WHERE $1::text IS NULL OR j.name ILIKE '%' || $1 || '%'
      ORDER BY j.name
      LIMIT 200`,
    [q || null],
  );

  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    affiliation: (row.affiliation as string | null) ?? null,
    rideCount: String(row.ride_count),
    hasNote: Boolean(row.has_note),
  }));
}

export async function getJockey(id: string): Promise<JockeyDetail | undefined> {
  await assertCan("jockeys");

  const { rows } = await query(
    `SELECT j.id, j.name, j.name_kana, j.affiliation, j.birth_year, j.debut_year,
            n.body AS note_body, n.author AS note_author
       FROM jockeys j
       LEFT JOIN jockey_notes n ON n.jockey_id = j.id
      WHERE j.id = $1`,
    [id],
  );

  const row = rows[0];
  if (!row) return undefined;

  return {
    id: String(row.id),
    name: String(row.name),
    nameKana: (row.name_kana as string | null) ?? null,
    affiliation: (row.affiliation as string | null) ?? null,
    birthYear: (row.birth_year as number | null) ?? null,
    debutYear: (row.debut_year as number | null) ?? null,
    note: row.note_body ? { body: String(row.note_body), author: String(row.note_author) } : null,
  };
}

export async function listJockeyRides(jockeyId: string): Promise<readonly JockeyRide[]> {
  await assertCan("jockeys");

  const { rows } = await query(
    `SELECT e.id AS entry_id, e.finish_position, e.popularity, e.corner_positions,
            r.id AS race_id, r.race_date, r.race_name,
            h.id AS horse_id, h.name AS horse_name
       FROM entries e
       JOIN races r ON r.id = e.race_id
       JOIN horses h ON h.id = e.horse_id
      WHERE e.jockey_id = $1
      ORDER BY r.race_date DESC`,
    [jockeyId],
  );

  return rows.map((row) => ({
    entryId: String(row.entry_id),
    raceId: String(row.race_id),
    raceDate: String(row.race_date),
    raceName: (row.race_name as string | null) ?? null,
    horseId: String(row.horse_id),
    horseName: String(row.horse_name),
    finishPosition: (row.finish_position as number | null) ?? null,
    popularity: (row.popularity as number | null) ?? null,
    cornerPositions: (row.corner_positions as string | null) ?? null,
  }));
}
