/**
 * 画面から登録する事実データの、入力の確かめ方。**DB を触らない部分だけを `lib/facts` から
 * 分けてある。** 素の Node で走るテストと、ブラウザで動く画面の部品の両方から読むため
 * （`lib/facts` の入口は DB と認証を読み込むので、どちらからも読めない）。
 *
 * 入っていい値の正本は DB の CHECK 制約で、ここはその写し（`lib/enums`）。画面で弾いて
 * 何が悪いかを返すために持っている。
 */
import {
  AFFILIATIONS,
  COURSE_LAYOUTS,
  ENTRY_STATUSES,
  GRADES,
  SEXES,
  SURFACES,
  TURNS,
  WEIGHT_RULES,
  type Affiliation,
  type CourseLayout,
  type EntryStatus,
  type Grade,
  type Sex,
  type Surface,
  type Turn,
  type WeightRule,
} from "../enums/index.ts";
import { normalizeRaceName } from "../race-name/index.ts";
import { checked, date, id, integer, oneOf, text } from "./fields.ts";

export type Parsed<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

/** 画面から届く値。`FormData` から取り出したものをそのまま入れる。 */
export type RawInput = Readonly<Record<string, unknown>>;

/** 生年・デビュー年として受け付ける範囲。先祖の馬をたどるので下は広く取る。 */
const YEAR_RANGE = { min: 1800, max: 2100 } as const;

function fail(message: string): { readonly ok: false; readonly message: string } {
  return { ok: false, message };
}

// ---------------------------------------------------------------------------
// courses
// ---------------------------------------------------------------------------

export type CourseInput = {
  readonly track: string;
  readonly surface: Surface;
  readonly distanceM: number;
  readonly turn: Turn;
  readonly layout: CourseLayout | null;
};

export function parseCourseInput(raw: RawInput): Parsed<CourseInput> {
  const track = text(raw.track);
  const surface = oneOf(raw.surface, SURFACES);
  const distanceM = integer(raw.distanceM, { min: 1, max: 10000 });
  const turn = oneOf(raw.turn, TURNS);
  const layout = oneOf(raw.layout, COURSE_LAYOUTS);

  if (!track) return fail("競馬場を入れてください。");
  if (!surface) return fail("芝・ダート・障害のどれかを選んでください。");
  if (!distanceM) return fail("距離はメートルの整数で入れてください。");
  if (!turn) return fail("回りを選んでください。");
  if (layout === undefined) return fail("内外の値が正しくありません。");

  return { ok: true, value: { track, surface, distanceM, turn, layout } };
}

// ---------------------------------------------------------------------------
// jockeys / trainers
// ---------------------------------------------------------------------------

export type JockeyInput = {
  readonly name: string;
  readonly nameKana: string | null;
  readonly birthYear: number | null;
  readonly debutYear: number | null;
  readonly affiliation: Affiliation | null;
};

export function parseJockeyInput(raw: RawInput): Parsed<JockeyInput> {
  const name = text(raw.name);
  const nameKana = text(raw.nameKana);
  const birthYear = integer(raw.birthYear, YEAR_RANGE);
  const debutYear = integer(raw.debutYear, YEAR_RANGE);
  const affiliation = oneOf(raw.affiliation, AFFILIATIONS);

  if (!name) return fail("名前を入れてください。");
  if (nameKana === undefined) return fail("読みの値が正しくありません。");
  if (birthYear === undefined) return fail("生年は西暦の4桁で入れてください。");
  if (debutYear === undefined) return fail("デビュー年は西暦の4桁で入れてください。");
  if (affiliation === undefined) return fail("所属の値が正しくありません。");

  return { ok: true, value: { name, nameKana, birthYear, debutYear, affiliation } };
}

export type TrainerInput = {
  readonly name: string;
  readonly nameKana: string | null;
  readonly openedOn: string | null;
  readonly affiliation: Affiliation | null;
};

/** `today` は日本時間の今日。開業日は今日より後を弾く。 */
export function parseTrainerInput(raw: RawInput, today: string): Parsed<TrainerInput> {
  const name = text(raw.name);
  const nameKana = text(raw.nameKana);
  const openedOn = date(raw.openedOn, { max: today });
  const affiliation = oneOf(raw.affiliation, AFFILIATIONS);

  if (!name) return fail("名前を入れてください。");
  if (nameKana === undefined) return fail("読みの値が正しくありません。");
  if (openedOn === undefined) return fail("開業日は今日までの実在する日付で入れてください。");
  if (affiliation === undefined) return fail("所属の値が正しくありません。");

  return { ok: true, value: { name, nameKana, openedOn, affiliation } };
}

// ---------------------------------------------------------------------------
// horses
// ---------------------------------------------------------------------------

export type HorseInput = {
  readonly name: string;
  readonly nameKana: string | null;
  readonly birthYear: number | null;
  readonly sex: Sex | null;
  readonly sireId: string | null;
  readonly damId: string | null;
  readonly trainerId: string | null;
  readonly isOverseas: boolean;
};

/**
 * 海外の馬かどうかの初期値。**馬名に英字が1文字でも入っていれば海外とみなす。**
 *
 * 既に登録してある馬を分けたときと同じ基準（db/migrations/0012）。最終的には入力した人が決める。
 */
export function looksOverseas(name: string): boolean {
  return /[A-Za-z]/.test(name);
}

export function parseHorseInput(raw: RawInput): Parsed<HorseInput> {
  const name = text(raw.name);
  const nameKana = text(raw.nameKana);
  const birthYear = integer(raw.birthYear, YEAR_RANGE);
  const sex = oneOf(raw.sex, SEXES);
  const sireId = id(raw.sireId);
  const damId = id(raw.damId);
  const trainerId = id(raw.trainerId);

  if (!name) return fail("馬名を入れてください。");
  if (nameKana === undefined) return fail("読みの値が正しくありません。");
  if (birthYear === undefined) return fail("生年は西暦の4桁で入れてください。");
  if (sex === undefined) return fail("性別の値が正しくありません。");
  if (sireId === undefined || damId === undefined) return fail("父・母の値が正しくありません。");
  if (trainerId === undefined) return fail("厩舎の値が正しくありません。");
  if (sireId !== null && sireId === damId) return fail("父と母に同じ馬は選べません。");

  return {
    ok: true,
    value: {
      name,
      nameKana,
      birthYear,
      sex,
      sireId,
      damId,
      trainerId,
      isOverseas: checked(raw.isOverseas),
    },
  };
}

/** 馬を作るときの引退。`retiredOn` が null なら、引退した日付が分からない。 */
export type NewHorseRetirement =
  | { readonly retired: false }
  | { readonly retired: true; readonly retiredOn: string | null };

/**
 * 馬を作るときの引退を確かめる。日付が分からないときの値（`1900-01-01`）は書き込む側で入れる。
 *
 * **海外の馬は引退を持たない**ので、海外なら常に引退していない扱い（docs/data-model.md#horses）。
 */
export function parseNewHorseRetirement(
  raw: RawInput,
  isOverseas: boolean,
  today: string,
): Parsed<NewHorseRetirement> {
  if (isOverseas || !checked(raw.retired)) return { ok: true, value: { retired: false } };

  const retiredOn = date(raw.retiredOn, { min: "1900-01-01", max: today });

  if (retiredOn === undefined) return fail("引退日は今日までの実在する日付で入れてください。");

  return { ok: true, value: { retired: true, retiredOn } };
}

// ---------------------------------------------------------------------------
// races
// ---------------------------------------------------------------------------

export type RaceInput = {
  readonly raceDate: string;
  readonly courseId: string;
  readonly meetingNumber: number | null;
  readonly meetingDay: number | null;
  readonly raceNumber: number | null;
  readonly raceName: string | null;
  readonly grade: Grade | null;
  readonly weightRule: WeightRule | null;
  readonly weatherForecast: string | null;
};

export function parseRaceInput(raw: RawInput): Parsed<RaceInput> {
  const raceDate = date(raw.raceDate, { min: "1800-01-01" });
  const courseId = id(raw.courseId);
  const meetingNumber = integer(raw.meetingNumber, { min: 1, max: 99 });
  const meetingDay = integer(raw.meetingDay, { min: 1, max: 99 });
  const raceNumber = integer(raw.raceNumber, { min: 1, max: 99 });
  const rawName = text(raw.raceName);
  const grade = oneOf(raw.grade, GRADES);
  const weightRule = oneOf(raw.weightRule, WEIGHT_RULES);
  const weatherForecast = text(raw.weatherForecast);

  if (!raceDate) return fail("日付を実在する日付で入れてください。");
  if (!courseId) return fail("コースを選んでください。");
  if (meetingNumber === undefined) return fail("開催回は1以上の整数で入れてください。");
  if (meetingDay === undefined) return fail("日目は1以上の整数で入れてください。");
  if (raceNumber === undefined) return fail("レース番号は1以上の整数で入れてください。");
  if (rawName === undefined) return fail("レース名の値が正しくありません。");
  if (grade === undefined) return fail("格の値が正しくありません。");
  if (weightRule === undefined) return fail("負担重量の値が正しくありません。");
  if (weatherForecast === undefined) return fail("天気予報の値が正しくありません。");

  const raceName = rawName === null ? null : normalizeRaceName(rawName);

  return {
    ok: true,
    value: {
      raceDate,
      courseId,
      meetingNumber,
      meetingDay,
      raceNumber,
      raceName: raceName === "" ? null : raceName,
      grade,
      weightRule,
      weatherForecast,
    },
  };
}

// ---------------------------------------------------------------------------
// entries
// ---------------------------------------------------------------------------

/** 1回に保存できる出走の行数。フルゲートより十分に多く取ってある。 */
export const ENTRY_ROWS_MAX = 40;

export type EntryRowInput = {
  /** 既に登録してある出走なら、その ID。新しく足す行は null。 */
  readonly entryId: string | null;
  readonly horseId: string;
  readonly jockeyId: string | null;
  readonly bracketNumber: number | null;
  readonly horseNumber: number | null;
  /** 斤量。`numeric(4,1)` に入れるので、小数1桁までの文字列のまま持つ。 */
  readonly weightCarried: string | null;
  readonly status: EntryStatus;
};

/**
 * 出走の行をまとめて確かめる。`rows` は画面が JSON で送ってくる配列。
 *
 * **厩舎は受け取らない。** 保存するときに馬の今の所属厩舎を写す（docs/product.md#画面）。
 */
export function parseEntryRows(rows: unknown): Parsed<readonly EntryRowInput[]> {
  if (!Array.isArray(rows)) return fail("出走の行が読めませんでした。");
  if (rows.length > ENTRY_ROWS_MAX) return fail(`出走は ${ENTRY_ROWS_MAX} 行までです。`);

  const parsed: EntryRowInput[] = [];

  for (const [index, row] of rows.entries()) {
    const label = `${index + 1}行目`;

    if (typeof row !== "object" || row === null) return fail(`${label}が読めませんでした。`);

    const value = row as RawInput;
    const entryId = id(value.entryId);
    const horseId = id(value.horseId);
    const jockeyId = id(value.jockeyId);
    const bracketNumber = integer(value.bracketNumber, { min: 1, max: 8 });
    const horseNumber = integer(value.horseNumber, { min: 1, max: 99 });
    const weightCarried = weight(value.weightCarried);
    const status = oneOf(value.status, ENTRY_STATUSES);

    if (entryId === undefined) return fail(`${label}の値が正しくありません。`);
    if (!horseId) return fail(`${label}の馬を選んでください。`);
    if (jockeyId === undefined) return fail(`${label}の騎手の値が正しくありません。`);
    if (bracketNumber === undefined) return fail(`${label}の枠番は1〜8で入れてください。`);
    if (horseNumber === undefined) return fail(`${label}の馬番は1以上の整数で入れてください。`);
    if (weightCarried === undefined) {
      return fail(`${label}の斤量は小数1桁までの数で入れてください。`);
    }
    if (status === undefined) return fail(`${label}の取消・除外の値が正しくありません。`);

    parsed.push({
      entryId,
      horseId,
      jockeyId,
      bracketNumber,
      horseNumber,
      weightCarried,
      status: status ?? "出走",
    });
  }

  const horseIds = parsed.map((row) => row.horseId);
  if (new Set(horseIds).size !== horseIds.length) return fail("同じ馬が2行以上あります。");

  const horseNumbers = parsed.flatMap((row) => (row.horseNumber === null ? [] : [row.horseNumber]));
  if (new Set(horseNumbers).size !== horseNumbers.length) return fail("馬番が重複しています。");

  const entryIds = parsed.flatMap((row) => (row.entryId === null ? [] : [row.entryId]));
  if (new Set(entryIds).size !== entryIds.length) return fail("同じ出走が2行以上あります。");

  return { ok: true, value: parsed };
}

/** 斤量。0より大きく、整数部2桁・小数1桁まで。空なら null。 */
function weight(value: unknown): string | null | undefined {
  const raw = typeof value === "number" ? String(value) : text(value);

  if (raw === null || raw === undefined) return raw;
  if (!/^[0-9]{1,2}(\.[0-9])?$/.test(raw)) return undefined;

  return Number(raw) > 0 ? raw : undefined;
}
