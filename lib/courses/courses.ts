import { query } from "../db/index.ts";
import { assertCan } from "../access/index.ts";

/** コースの画面が読むもの。コースは競馬場・芝ダート・距離・内外の組み合わせで1つ。 */

export type CourseSummary = {
  readonly id: string;
  readonly track: string;
  readonly surface: string;
  readonly distanceM: number;
  readonly turn: string;
  readonly layout: string | null;
  readonly raceCount: string;
  readonly hasNote: boolean;
};

export type CourseDetail = CourseSummary & {
  readonly note: { readonly body: string; readonly author: string } | null;
};

export type CourseRace = {
  readonly id: string;
  readonly raceDate: string;
  readonly raceName: string | null;
  readonly grade: string | null;
  readonly trackCondition: string | null;
  readonly hasNote: boolean;
};

function toSummary(row: Record<string, unknown>): CourseSummary {
  return {
    id: String(row.id),
    track: String(row.track),
    surface: String(row.surface),
    distanceM: Number(row.distance_m),
    turn: String(row.turn),
    layout: (row.layout as string | null) ?? null,
    raceCount: String(row.race_count),
    hasNote: Boolean(row.has_note),
  };
}

export async function listCourses(options: { readonly q?: string } = {}): Promise<
  readonly CourseSummary[]
> {
  await assertCan("courses");

  const q = options.q?.trim();

  const { rows } = await query(
    `SELECT c.id, c.track, c.surface, c.distance_m, c.turn, c.layout,
            (SELECT count(*) FROM races r WHERE r.course_id = c.id) AS race_count,
            EXISTS (SELECT 1 FROM course_notes n WHERE n.course_id = c.id) AS has_note
       FROM courses c
      WHERE EXISTS (SELECT 1 FROM course_notes n WHERE n.course_id = c.id)
        AND ($1::text IS NULL OR c.track ILIKE '%' || $1 || '%')
      ORDER BY c.track, c.surface, c.distance_m`,
    [q || null],
  );

  return rows.map(toSummary);
}

export async function getCourse(id: string): Promise<CourseDetail | undefined> {
  await assertCan("courses");

  const { rows } = await query(
    `SELECT c.id, c.track, c.surface, c.distance_m, c.turn, c.layout,
            (SELECT count(*) FROM races r WHERE r.course_id = c.id) AS race_count,
            n.body AS note_body, n.author AS note_author,
            (n.body IS NOT NULL) AS has_note
       FROM courses c
       LEFT JOIN course_notes n ON n.course_id = c.id
      WHERE c.id = $1`,
    [id],
  );

  const row = rows[0];
  if (!row) return undefined;

  return {
    ...toSummary(row),
    note: row.note_body ? { body: String(row.note_body), author: String(row.note_author) } : null,
  };
}

export async function listCourseRaces(courseId: string): Promise<readonly CourseRace[]> {
  await assertCan("courses");

  const { rows } = await query(
    `SELECT r.id, r.race_date, r.race_name, r.grade, r.track_condition,
            EXISTS (SELECT 1 FROM race_notes n WHERE n.race_id = r.id) AS has_note
       FROM races r
      WHERE r.course_id = $1
      ORDER BY r.race_date DESC`,
    [courseId],
  );

  return rows.map((row) => ({
    id: String(row.id),
    raceDate: String(row.race_date),
    raceName: (row.race_name as string | null) ?? null,
    grade: (row.grade as string | null) ?? null,
    trackCondition: (row.track_condition as string | null) ?? null,
    hasNote: Boolean(row.has_note),
  }));
}
