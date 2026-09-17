import { can, assertCan } from "../access/index.ts";
import { getViewer } from "../auth/index.ts";
import { query, transaction, type Statement } from "../db/index.ts";
import {
  todayInJapan,
  parseCourseInput,
  parseEntryRows,
  parseHorseInput,
  parseJockeyInput,
  parseNewHorseRetirement,
  parseRaceInput,
  parseTrainerInput,
  type RawInput,
} from "../fact-input/index.ts";

/**
 * 画面から事実データを登録し、直す。**owner だけが呼べる**（`data.edit`）。
 *
 * Server Function は画面を通らない POST からも呼べるので、**認証はこの中で確かめる**。
 * 評価（`*_notes`）はここから書かない（docs/product.md#画面）。
 */

/** 日付が分からない引退日（docs/data-model.md#horses）。`lib/horses` の値と同じ。 */
const UNKNOWN_RETIRED_ON = "1900-01-01";

/** 同名・同じ日付のように、作る前に見せる既存の行。 */
export type Duplicate = { readonly id: string; readonly label: string };

export type CreateResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly message: string; readonly duplicates?: readonly Duplicate[] };

export type UpdateResult = { readonly ok: true } | { readonly ok: false; readonly message: string };

/** 選ぶ欄に出す候補。 */
export type Option = { readonly id: string; readonly label: string };

/**
 * DB が弾いたときの説明。CHECK 制約・外部キー・一意のどれに当たったかだけを返す。
 * それ以外は投げ直す（画面の不具合として表に出すため）。
 */
function rejected(error: unknown): { readonly ok: false; readonly message: string } {
  const code = (error as { code?: unknown } | null)?.code;

  if (code === "23505") return { ok: false, message: "同じものが既に登録されています。" };
  if (code === "23503") return { ok: false, message: "選んだものが見つかりませんでした。" };
  if (code === "23514") return { ok: false, message: "入れられない値が含まれています。" };

  throw error;
}

async function canEdit(): Promise<boolean> {
  return can(await getViewer(), "data.edit");
}

// ---------------------------------------------------------------------------
// courses
// ---------------------------------------------------------------------------

export type CourseFacts = {
  readonly id: string;
  readonly track: string;
  readonly surface: string;
  readonly distanceM: number;
  readonly turn: string;
  readonly layout: string | null;
};

function courseLabel(row: Record<string, unknown>): string {
  const layout = row.layout ? `（${String(row.layout)}）` : "";

  return `${String(row.track)} ${String(row.surface)}${String(row.distance_m)}m ${String(row.turn)}${layout}`;
}

/**
 * コースを作る。**同じコースが既にあれば作らず、その行を返す**（DB も同じ組み合わせを弾く）。
 */
export async function createCourse(raw: RawInput): Promise<CreateResult> {
  await assertCan("data.edit");

  const parsed = parseCourseInput(raw);
  if (!parsed.ok) return parsed;

  const { track, surface, distanceM, turn, layout } = parsed.value;
  const { rows } = await query(
    `INSERT INTO courses (track, surface, distance_m, turn, layout)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT ON CONSTRAINT courses_natural_key DO NOTHING
     RETURNING id`,
    [track, surface, distanceM, turn, layout],
  );

  if (rows[0]) return { ok: true, id: String(rows[0].id) };

  const existing = await query(
    `SELECT id, track, surface, distance_m, turn, layout FROM courses
      WHERE track = $1 AND surface = $2 AND distance_m = $3 AND layout IS NOT DISTINCT FROM $4`,
    [track, surface, distanceM, layout],
  );

  return {
    ok: false,
    message: "このコースは既に登録されています。",
    duplicates: existing.rows.map((row) => ({ id: String(row.id), label: courseLabel(row) })),
  };
}

export async function updateCourse(courseId: unknown, raw: RawInput): Promise<UpdateResult> {
  await assertCan("data.edit");

  const parsed = parseCourseInput(raw);
  if (!parsed.ok) return parsed;

  const { track, surface, distanceM, turn, layout } = parsed.value;

  try {
    const { rowCount } = await query(
      `UPDATE courses SET track = $2, surface = $3, distance_m = $4, turn = $5, layout = $6
        WHERE id = $1`,
      [String(courseId), track, surface, distanceM, turn, layout],
    );

    return found(rowCount);
  } catch (error) {
    return rejected(error);
  }
}

/** 直す確認画面の初期値。**owner でなければ undefined**（画面で呼んでも 404 にしない）。 */
export async function getCourseFacts(courseId: string): Promise<CourseFacts | undefined> {
  if (!(await canEdit())) return undefined;

  const { rows } = await query(
    `SELECT id, track, surface, distance_m, turn, layout FROM courses WHERE id = $1`,
    [courseId],
  );
  const row = rows[0];

  return row
    ? {
        id: String(row.id),
        track: String(row.track),
        surface: String(row.surface),
        distanceM: Number(row.distance_m),
        turn: String(row.turn),
        layout: (row.layout as string | null) ?? null,
      }
    : undefined;
}

/** 登録済みの競馬場名。コースを作るときに選ばせる。 */
export async function listTracks(): Promise<readonly string[]> {
  await assertCan("data.edit");

  const { rows } = await query(`SELECT DISTINCT track FROM courses ORDER BY track`);

  return rows.map((row) => String(row.track));
}

/** レースを作るときに選ぶコース。競馬場ごとに並べる。 */
export async function listCourseOptions(): Promise<readonly Option[]> {
  await assertCan("data.edit");

  const { rows } = await query(
    `SELECT id, track, surface, distance_m, turn, layout FROM courses
      ORDER BY track, surface, distance_m, layout NULLS FIRST`,
  );

  return rows.map((row) => ({ id: String(row.id), label: courseLabel(row) }));
}

// ---------------------------------------------------------------------------
// jockeys / trainers
// ---------------------------------------------------------------------------

export type JockeyFacts = {
  readonly id: string;
  readonly name: string;
  readonly nameKana: string | null;
  readonly birthYear: number | null;
  readonly debutYear: number | null;
  readonly affiliation: string | null;
};

export type TrainerFacts = {
  readonly id: string;
  readonly name: string;
  readonly nameKana: string | null;
  readonly openedOn: string | null;
  readonly affiliation: string | null;
};

/**
 * 同名の行を探す。**馬・騎手・厩舎は同名が許される**ので、DB では止まらない
 * （docs/data-model.md#horses）。作る前に出して、別のものとして作るかを決めてもらう。
 */
async function sameName(
  table: "horses" | "jockeys" | "trainers",
  name: string,
): Promise<readonly Duplicate[]> {
  const detail =
    table === "horses"
      ? `concat_ws(' ', name, CASE WHEN birth_year IS NULL THEN NULL ELSE birth_year || '年生' END, sex)`
      : `concat_ws(' ', name, affiliation)`;
  const { rows } = await query(
    `SELECT id, ${detail} AS label FROM ${table} WHERE name = $1 ORDER BY id LIMIT 20`,
    [name],
  );

  return rows.map((row) => ({ id: String(row.id), label: String(row.label) }));
}

function duplicatesFound(duplicates: readonly Duplicate[]): CreateResult {
  return {
    ok: false,
    message: "同じ名前で既に登録されています。別のものとして登録するときは、確認にチェックを入れてもう一度押してください。",
    duplicates,
  };
}

export async function createJockey(raw: RawInput, allowSameName: boolean): Promise<CreateResult> {
  await assertCan("data.edit");

  const parsed = parseJockeyInput(raw);
  if (!parsed.ok) return parsed;

  const { name, nameKana, birthYear, debutYear, affiliation } = parsed.value;

  if (!allowSameName) {
    const duplicates = await sameName("jockeys", name);
    if (duplicates.length > 0) return duplicatesFound(duplicates);
  }

  try {
    const { rows } = await query(
      `INSERT INTO jockeys (name, name_kana, birth_year, debut_year, affiliation)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name, nameKana, birthYear, debutYear, affiliation],
    );

    return { ok: true, id: String(rows[0]?.id) };
  } catch (error) {
    return rejected(error);
  }
}

export async function updateJockey(jockeyId: unknown, raw: RawInput): Promise<UpdateResult> {
  await assertCan("data.edit");

  const parsed = parseJockeyInput(raw);
  if (!parsed.ok) return parsed;

  const { name, nameKana, birthYear, debutYear, affiliation } = parsed.value;

  try {
    const { rowCount } = await query(
      `UPDATE jockeys SET name = $2, name_kana = $3, birth_year = $4, debut_year = $5, affiliation = $6
        WHERE id = $1`,
      [String(jockeyId), name, nameKana, birthYear, debutYear, affiliation],
    );

    return found(rowCount);
  } catch (error) {
    return rejected(error);
  }
}

export async function getJockeyFacts(jockeyId: string): Promise<JockeyFacts | undefined> {
  if (!(await canEdit())) return undefined;

  const { rows } = await query(
    `SELECT id, name, name_kana, birth_year, debut_year, affiliation FROM jockeys WHERE id = $1`,
    [jockeyId],
  );
  const row = rows[0];

  return row
    ? {
        id: String(row.id),
        name: String(row.name),
        nameKana: (row.name_kana as string | null) ?? null,
        birthYear: (row.birth_year as number | null) ?? null,
        debutYear: (row.debut_year as number | null) ?? null,
        affiliation: (row.affiliation as string | null) ?? null,
      }
    : undefined;
}

export async function createTrainer(raw: RawInput, allowSameName: boolean): Promise<CreateResult> {
  await assertCan("data.edit");

  const parsed = parseTrainerInput(raw, todayInJapan());
  if (!parsed.ok) return parsed;

  const { name, nameKana, openedOn, affiliation } = parsed.value;

  if (!allowSameName) {
    const duplicates = await sameName("trainers", name);
    if (duplicates.length > 0) return duplicatesFound(duplicates);
  }

  try {
    const { rows } = await query(
      `INSERT INTO trainers (name, name_kana, opened_on, affiliation)
       VALUES ($1, $2, $3::date, $4) RETURNING id`,
      [name, nameKana, openedOn, affiliation],
    );

    return { ok: true, id: String(rows[0]?.id) };
  } catch (error) {
    return rejected(error);
  }
}

export async function updateTrainer(trainerId: unknown, raw: RawInput): Promise<UpdateResult> {
  await assertCan("data.edit");

  const parsed = parseTrainerInput(raw, todayInJapan());
  if (!parsed.ok) return parsed;

  const { name, nameKana, openedOn, affiliation } = parsed.value;

  try {
    const { rowCount } = await query(
      `UPDATE trainers SET name = $2, name_kana = $3, opened_on = $4::date, affiliation = $5
        WHERE id = $1`,
      [String(trainerId), name, nameKana, openedOn, affiliation],
    );

    return found(rowCount);
  } catch (error) {
    return rejected(error);
  }
}

export async function getTrainerFacts(trainerId: string): Promise<TrainerFacts | undefined> {
  if (!(await canEdit())) return undefined;

  const { rows } = await query(
    `SELECT id, name, name_kana, opened_on, affiliation FROM trainers WHERE id = $1`,
    [trainerId],
  );
  const row = rows[0];

  return row
    ? {
        id: String(row.id),
        name: String(row.name),
        nameKana: (row.name_kana as string | null) ?? null,
        openedOn: (row.opened_on as string | null) ?? null,
        affiliation: (row.affiliation as string | null) ?? null,
      }
    : undefined;
}

// ---------------------------------------------------------------------------
// horses
// ---------------------------------------------------------------------------

export type HorseFacts = {
  readonly id: string;
  readonly name: string;
  readonly nameKana: string | null;
  readonly birthYear: number | null;
  readonly sex: string | null;
  readonly sire: Option | null;
  readonly dam: Option | null;
  readonly trainer: Option | null;
  readonly isOverseas: boolean;
};

/**
 * 馬を作る。父・母・厩舎は登録済みのものを選ぶだけ。**この画面から先祖の馬は作らない**
 * （docs/agent-design.md#血統で参照する先祖は分析対象でなければ登録しない）。
 */
export async function createHorse(raw: RawInput, allowSameName: boolean): Promise<CreateResult> {
  await assertCan("data.edit");

  const parsed = parseHorseInput(raw);
  if (!parsed.ok) return parsed;

  const retirement = parseNewHorseRetirement(raw, parsed.value.isOverseas, todayInJapan());
  if (!retirement.ok) return retirement;

  const { name, nameKana, birthYear, sex, sireId, damId, trainerId, isOverseas } = parsed.value;
  const retiredAt = retirement.value.retired
    ? (retirement.value.retiredOn ?? UNKNOWN_RETIRED_ON)
    : null;

  if (!allowSameName) {
    const duplicates = await sameName("horses", name);
    if (duplicates.length > 0) return duplicatesFound(duplicates);
  }

  try {
    const { rows } = await query(
      `INSERT INTO horses (name, name_kana, birth_year, sex, sire_id, dam_id, trainer_id, is_overseas, retired_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::date) RETURNING id`,
      [name, nameKana, birthYear, sex, sireId, damId, trainerId, isOverseas, retiredAt],
    );

    return { ok: true, id: String(rows[0]?.id) };
  } catch (error) {
    return rejected(error);
  }
}

/**
 * 馬の基本情報を直す。**引退はここでは触らない**（馬の詳細画面の「現役／引退に変更」で直す）。
 *
 * 海外の馬に変えたときは引退日を空にする。海外の馬は引退を持たないため（docs/data-model.md#horses）。
 */
export async function updateHorse(horseId: unknown, raw: RawInput): Promise<UpdateResult> {
  await assertCan("data.edit");

  const parsed = parseHorseInput(raw);
  if (!parsed.ok) return parsed;

  const { name, nameKana, birthYear, sex, sireId, damId, trainerId, isOverseas } = parsed.value;
  const id = String(horseId);

  if (sireId === id || damId === id) return { ok: false, message: "父・母に自分自身は選べません。" };

  try {
    const { rowCount } = await query(
      `UPDATE horses
          SET name = $2, name_kana = $3, birth_year = $4, sex = $5,
              sire_id = $6, dam_id = $7, trainer_id = $8, is_overseas = $9,
              retired_at = CASE WHEN $9 THEN NULL ELSE retired_at END
        WHERE id = $1`,
      [id, name, nameKana, birthYear, sex, sireId, damId, trainerId, isOverseas],
    );

    return found(rowCount);
  } catch (error) {
    return rejected(error);
  }
}

export async function getHorseFacts(horseId: string): Promise<HorseFacts | undefined> {
  if (!(await canEdit())) return undefined;

  const { rows } = await query(
    `SELECT h.id, h.name, h.name_kana, h.birth_year, h.sex, h.is_overseas,
            sire.id AS sire_id, sire.name AS sire_name,
            dam.id AS dam_id, dam.name AS dam_name,
            t.id AS trainer_id, t.name AS trainer_name
       FROM horses h
       LEFT JOIN horses sire ON sire.id = h.sire_id
       LEFT JOIN horses dam ON dam.id = h.dam_id
       LEFT JOIN trainers t ON t.id = h.trainer_id
      WHERE h.id = $1`,
    [horseId],
  );
  const row = rows[0];

  if (!row) return undefined;

  const option = (idValue: unknown, label: unknown): Option | null =>
    idValue === null ? null : { id: String(idValue), label: String(label) };

  return {
    id: String(row.id),
    name: String(row.name),
    nameKana: (row.name_kana as string | null) ?? null,
    birthYear: (row.birth_year as number | null) ?? null,
    sex: (row.sex as string | null) ?? null,
    sire: option(row.sire_id, row.sire_name),
    dam: option(row.dam_id, row.dam_name),
    trainer: option(row.trainer_id, row.trainer_name),
    isOverseas: Boolean(row.is_overseas),
  };
}

// ---------------------------------------------------------------------------
// races
// ---------------------------------------------------------------------------

export type RaceFacts = {
  readonly id: string;
  readonly raceDate: string;
  readonly courseId: string;
  readonly meetingNumber: number | null;
  readonly meetingDay: number | null;
  readonly raceNumber: number | null;
  readonly raceName: string | null;
  readonly grade: string | null;
  readonly weightRule: string | null;
  readonly weatherForecast: string | null;
};

const RACE_LABEL = `concat_ws(' ', r.race_date::text, c.track, CASE WHEN r.race_number IS NULL THEN NULL ELSE r.race_number || 'R' END, coalesce(r.race_name, '（名前なし）'))`;

/**
 * レースを作る。**同じ日付・同じコースのレースがあれば先に見せる。** レース番号が空の
 * レースは、DB の一意の制約では二重登録を止められないため（docs/data-model.md#races）。
 */
export async function createRace(raw: RawInput, allowSameDay: boolean): Promise<CreateResult> {
  await assertCan("data.edit");

  const parsed = parseRaceInput(raw);
  if (!parsed.ok) return parsed;

  const value = parsed.value;

  if (!allowSameDay) {
    const { rows } = await query(
      `SELECT r.id, ${RACE_LABEL} AS label
         FROM races r JOIN courses c ON c.id = r.course_id
        WHERE r.race_date = $1 AND r.course_id = $2
        ORDER BY r.race_number NULLS LAST`,
      [value.raceDate, value.courseId],
    );

    if (rows.length > 0) {
      return {
        ok: false,
        message: "同じ日付・同じコースのレースが既に登録されています。別のレースとして登録するときは、確認にチェックを入れてもう一度押してください。",
        duplicates: rows.map((row) => ({ id: String(row.id), label: String(row.label) })),
      };
    }
  }

  try {
    const { rows } = await query(
      `INSERT INTO races (race_date, course_id, meeting_number, meeting_day, race_number,
                          race_name, grade, weight_rule, weather_forecast)
       VALUES ($1::date, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        value.raceDate,
        value.courseId,
        value.meetingNumber,
        value.meetingDay,
        value.raceNumber,
        value.raceName,
        value.grade,
        value.weightRule,
        value.weatherForecast,
      ],
    );

    return { ok: true, id: String(rows[0]?.id) };
  } catch (error) {
    return rejected(error);
  }
}

export async function updateRace(raceId: unknown, raw: RawInput): Promise<UpdateResult> {
  await assertCan("data.edit");

  const parsed = parseRaceInput(raw);
  if (!parsed.ok) return parsed;

  const value = parsed.value;

  try {
    const { rowCount } = await query(
      `UPDATE races
          SET race_date = $2::date, course_id = $3, meeting_number = $4, meeting_day = $5,
              race_number = $6, race_name = $7, grade = $8, weight_rule = $9, weather_forecast = $10
        WHERE id = $1`,
      [
        String(raceId),
        value.raceDate,
        value.courseId,
        value.meetingNumber,
        value.meetingDay,
        value.raceNumber,
        value.raceName,
        value.grade,
        value.weightRule,
        value.weatherForecast,
      ],
    );

    return found(rowCount);
  } catch (error) {
    return rejected(error);
  }
}

export async function getRaceFacts(raceId: string): Promise<RaceFacts | undefined> {
  if (!(await canEdit())) return undefined;

  const { rows } = await query(
    `SELECT id, race_date, course_id, meeting_number, meeting_day, race_number,
            race_name, grade, weight_rule, weather_forecast
       FROM races WHERE id = $1`,
    [raceId],
  );
  const row = rows[0];

  return row
    ? {
        id: String(row.id),
        raceDate: String(row.race_date),
        courseId: String(row.course_id),
        meetingNumber: (row.meeting_number as number | null) ?? null,
        meetingDay: (row.meeting_day as number | null) ?? null,
        raceNumber: (row.race_number as number | null) ?? null,
        raceName: (row.race_name as string | null) ?? null,
        grade: (row.grade as string | null) ?? null,
        weightRule: (row.weight_rule as string | null) ?? null,
        weatherForecast: (row.weather_forecast as string | null) ?? null,
      }
    : undefined;
}

// ---------------------------------------------------------------------------
// entries
// ---------------------------------------------------------------------------

export type EntrySheetRow = {
  readonly entryId: string;
  readonly horse: Option;
  readonly jockey: Option | null;
  readonly bracketNumber: number | null;
  readonly horseNumber: number | null;
  readonly weightCarried: string | null;
  readonly status: string;
  /** 評価・コメント・印・買い目・結果のどれも付いていなければ true。外せるのはこの行だけ。 */
  readonly removable: boolean;
};

export type EntrySheet = {
  readonly race: Option;
  readonly entryListComplete: boolean;
  readonly rows: readonly EntrySheetRow[];
};

/**
 * 出走を外してよいかの条件。**何かが付いた出走は外さない。** 評価やコメントは出走を消すと
 * 一緒に消え、印や買い目は出走を消せないように縛ってある（db/schema.sql の外部キー）。
 */
const REMOVABLE = `(
  e.finish_position IS NULL
  AND NOT EXISTS (SELECT 1 FROM entry_notes x WHERE x.entry_id = e.id)
  AND NOT EXISTS (SELECT 1 FROM entry_comments x WHERE x.entry_id = e.id)
  AND NOT EXISTS (SELECT 1 FROM ai_predictions x WHERE x.entry_id = e.id)
  AND NOT EXISTS (SELECT 1 FROM my_predictions x WHERE x.entry_id = e.id)
  AND NOT EXISTS (SELECT 1 FROM ai_bet_legs x WHERE x.entry_id = e.id)
  AND NOT EXISTS (SELECT 1 FROM my_bet_legs x WHERE x.entry_id = e.id)
)`;

/** 出走の登録画面に出す、そのレースの今の出走。レースが無ければ undefined。 */
export async function getEntrySheet(raceId: string): Promise<EntrySheet | undefined> {
  await assertCan("data.edit");

  const race = await query(
    `SELECT r.id, r.entry_list_complete, ${RACE_LABEL} AS label
       FROM races r JOIN courses c ON c.id = r.course_id
      WHERE r.id = $1`,
    [raceId],
  );
  const raceRow = race.rows[0];

  if (!raceRow) return undefined;

  const { rows } = await query(
    `SELECT e.id, e.bracket_number, e.horse_number, e.weight_carried::text AS weight_carried, e.status,
            h.id AS horse_id, h.name AS horse_name,
            j.id AS jockey_id, j.name AS jockey_name,
            ${REMOVABLE} AS removable
       FROM entries e
       JOIN horses h ON h.id = e.horse_id
       LEFT JOIN jockeys j ON j.id = e.jockey_id
      WHERE e.race_id = $1
      ORDER BY e.horse_number NULLS LAST, e.id`,
    [raceId],
  );

  return {
    race: { id: String(raceRow.id), label: String(raceRow.label) },
    entryListComplete: Boolean(raceRow.entry_list_complete),
    rows: rows.map((row) => ({
      entryId: String(row.id),
      horse: { id: String(row.horse_id), label: String(row.horse_name) },
      jockey: row.jockey_id === null ? null : { id: String(row.jockey_id), label: String(row.jockey_name) },
      bracketNumber: (row.bracket_number as number | null) ?? null,
      horseNumber: (row.horse_number as number | null) ?? null,
      weightCarried: (row.weight_carried as string | null) ?? null,
      status: String(row.status),
      removable: Boolean(row.removable),
    })),
  };
}

/**
 * そのレースの出走を、画面の表のとおりにそろえる。**全部を1つのトランザクションで流す。**
 *
 * - 表から消えた行は外す。外せない行（`REMOVABLE` を満たさない）が1つでもあれば何もしない
 * - 残った行は直す。**馬を替えた行だけ、厩舎を新しい馬の今の所属厩舎にする。** 替えていない行は
 *   登録したときの厩舎のまま（出走の厩舎は当時の所属なので、転厩しても書き換えない）
 * - 新しい行は、馬の今の所属厩舎を写して足す。一度外した馬を足し直した行は、元の出走を直す
 * - `complete` を出馬表を全頭入れたかの印（`entry_list_complete`）に入れる
 */
export async function saveEntries(
  raceId: unknown,
  rowsJson: unknown,
  complete: boolean,
): Promise<UpdateResult> {
  await assertCan("data.edit");

  const race = String(raceId);
  let rawRows: unknown;

  try {
    rawRows = JSON.parse(String(rowsJson));
  } catch {
    return { ok: false, message: "出走の行が読めませんでした。" };
  }

  const parsed = parseEntryRows(rawRows);
  if (!parsed.ok) return parsed;

  const current = await query(
    `SELECT e.id, e.horse_id, ${REMOVABLE} AS removable FROM entries e WHERE e.race_id = $1`,
    [race],
  );
  const existing = new Map(
    current.rows.map((row) => [
      String(row.id),
      { horseId: String(row.horse_id), removable: Boolean(row.removable) },
    ]),
  );
  const byHorse = new Map([...existing].map(([entryId, entry]) => [entry.horseId, entryId]));

  // 足した行のうち、このレースに既に居る馬は、その出走を直す
  const rows = parsed.value.map((row) =>
    row.entryId === null && byHorse.has(row.horseId)
      ? { ...row, entryId: byHorse.get(row.horseId) ?? null }
      : row,
  );

  if (rows.some((row) => row.entryId !== null && !existing.has(row.entryId))) {
    return { ok: false, message: "このレースに無い出走が含まれています。画面を読み込み直してください。" };
  }

  const kept = new Set(rows.flatMap((row) => (row.entryId === null ? [] : [row.entryId])));
  const removed = [...existing.keys()].filter((entryId) => !kept.has(entryId));

  if (removed.some((entryId) => !existing.get(entryId)?.removable)) {
    return {
      ok: false,
      message: "評価・印・買い目・結果のどれかが付いた出走は外せません。",
    };
  }

  const updates = rows.filter((row) => row.entryId !== null);
  const inserts = rows.filter((row) => row.entryId === null);
  const columns = (list: typeof rows) => [
    list.map((row) => row.entryId),
    list.map((row) => row.horseId),
    list.map((row) => row.jockeyId),
    list.map((row) => row.bracketNumber),
    list.map((row) => row.horseNumber),
    list.map((row) => row.weightCarried),
    list.map((row) => row.status),
  ];
  const input = `unnest($2::bigint[], $3::bigint[], $4::bigint[], $5::int[], $6::int[], $7::numeric[], $8::text[])
    AS i(entry_id, horse_id, jockey_id, bracket_number, horse_number, weight_carried, status)`;

  const statements: Statement[] = [
    {
      text: `DELETE FROM entries e WHERE e.race_id = $1 AND e.id = ANY($2::bigint[]) AND ${REMOVABLE}`,
      params: [race, removed],
    },
    // 馬番を入れ替えた行が、途中で一意の制約に当たらないように先に空ける
    {
      text: `UPDATE entries SET horse_number = NULL WHERE race_id = $1 AND id = ANY($2::bigint[])`,
      params: [race, updates.map((row) => row.entryId)],
    },
    {
      text: `UPDATE entries e
                SET horse_id = i.horse_id,
                    jockey_id = i.jockey_id,
                    trainer_id = CASE WHEN e.horse_id = i.horse_id THEN e.trainer_id ELSE h.trainer_id END,
                    bracket_number = i.bracket_number,
                    horse_number = i.horse_number,
                    weight_carried = i.weight_carried,
                    status = i.status
               FROM ${input}
               JOIN horses h ON h.id = i.horse_id
              WHERE e.id = i.entry_id AND e.race_id = $1`,
      params: [race, ...columns(updates)],
    },
    {
      text: `INSERT INTO entries (race_id, horse_id, jockey_id, trainer_id, bracket_number,
                                  horse_number, weight_carried, status)
             SELECT $1, i.horse_id, i.jockey_id, h.trainer_id, i.bracket_number,
                    i.horse_number, i.weight_carried, i.status
               FROM ${input}
               JOIN horses h ON h.id = i.horse_id`,
      params: [race, ...columns(inserts)],
    },
    {
      text: `UPDATE races SET entry_list_complete = $2 WHERE id = $1`,
      params: [race, complete],
    },
  ];

  try {
    const results = await transaction(statements);

    return found(results.at(-1)?.rowCount ?? 0);
  } catch (error) {
    return rejected(error);
  }
}

// ---------------------------------------------------------------------------
// 選ぶ欄の候補
// ---------------------------------------------------------------------------

const SEARCH_LIMIT = 20;

function searchTerm(q: unknown): string | null {
  const value = typeof q === "string" ? q.trim() : "";

  return value === "" ? null : value;
}

export async function searchHorses(q: unknown): Promise<readonly Option[]> {
  await assertCan("data.edit");

  const term = searchTerm(q);
  if (!term) return [];

  const { rows } = await query(
    `SELECT id,
            concat_ws(' ', name, CASE WHEN birth_year IS NULL THEN NULL ELSE birth_year || '年生' END, sex) AS label
       FROM horses
      WHERE name ILIKE '%' || $1 || '%' OR name_kana ILIKE '%' || $1 || '%'
      ORDER BY (name = $1) DESC, name, id
      LIMIT ${SEARCH_LIMIT}`,
    [term],
  );

  return rows.map((row) => ({ id: String(row.id), label: String(row.label) }));
}

async function searchPeople(table: "jockeys" | "trainers", q: unknown): Promise<readonly Option[]> {
  await assertCan("data.edit");

  const term = searchTerm(q);
  if (!term) return [];

  const { rows } = await query(
    `SELECT id, concat_ws(' ', name, affiliation) AS label
       FROM ${table}
      WHERE name ILIKE '%' || $1 || '%' OR name_kana ILIKE '%' || $1 || '%'
      ORDER BY (name = $1) DESC, name, id
      LIMIT ${SEARCH_LIMIT}`,
    [term],
  );

  return rows.map((row) => ({ id: String(row.id), label: String(row.label) }));
}

export async function searchJockeys(q: unknown): Promise<readonly Option[]> {
  return searchPeople("jockeys", q);
}

export async function searchTrainers(q: unknown): Promise<readonly Option[]> {
  return searchPeople("trainers", q);
}

/**
 * レースを探す。**出馬表が揃っていないレースも出す**（`/races` の一覧には出ないため）。
 * レース名・競馬場名・日付（`2026-09` のような前方一致）で探す。
 */
export async function searchRaces(q: unknown): Promise<readonly Option[]> {
  await assertCan("data.edit");

  const term = searchTerm(q);
  if (!term) return [];

  const { rows } = await query(
    `SELECT r.id, ${RACE_LABEL} AS label
       FROM races r JOIN courses c ON c.id = r.course_id
      WHERE r.race_name ILIKE '%' || $1 || '%'
         OR c.track ILIKE '%' || $1 || '%'
         OR r.race_date::text LIKE $1 || '%'
      ORDER BY r.race_date DESC, r.race_number NULLS LAST
      LIMIT ${SEARCH_LIMIT}`,
    [term],
  );

  return rows.map((row) => ({ id: String(row.id), label: String(row.label) }));
}

function found(rowCount: number | null): UpdateResult {
  return (rowCount ?? 0) > 0
    ? { ok: true }
    : { ok: false, message: "対象が見つかりませんでした。画面を読み込み直してください。" };
}
