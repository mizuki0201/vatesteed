/**
 * 各列に入っていい値。
 *
 * **正本は DB 側の CHECK 制約で、ここはその写し。** Postgres の CHECK は TypeScript から
 * 読めないので二重管理は避けられない。ズレたら `enums.test.ts` が落ちる。値を足すときは
 * `db/migrations/` に .sql を足して流したうえで、ここも直す。
 *
 * **名前は enums だが、DB は enum 型を使っていない。** `text` + CHECK 制約で縛っている
 * （enum 型は値の削除と並べ替えができないため。docs/data-model.md#入っていい値）。
 * ここで言う enum は「値が固定のリストである型」という一般的な意味で、保存の仕組みの
 * 話ではない。マイグレーションで `CREATE TYPE ... AS ENUM` を書かないこと。
 *
 * 印（◎○▲）だけはテーブルにしている。記号と並び順という値以外の情報がぶら下がるため。
 */

// ---------------------------------------------------------------------------
// courses
// ---------------------------------------------------------------------------

export const SURFACES = ["芝", "ダート", "障害"] as const;
export type Surface = (typeof SURFACES)[number];

export const TURNS = ["右", "左", "直線"] as const;
export type Turn = (typeof TURNS)[number];

/** 京都芝1400のように同じ距離で内・外が両方あるコース用。区別が無いコースは null。 */
export const COURSE_LAYOUTS = ["内", "外"] as const;
export type CourseLayout = (typeof COURSE_LAYOUTS)[number];

// ---------------------------------------------------------------------------
// races
// ---------------------------------------------------------------------------

export const GRADES = [
  "G1",
  "G2",
  "G3",
  "J.G1",
  "J.G2",
  "J.G3",
  "Jpn1",
  "Jpn2",
  "Jpn3",
  "OP",
  "L",
  "3勝",
  "2勝",
  "1勝",
  "新馬",
  "未勝利",
] as const;
export type Grade = (typeof GRADES)[number];

export const WEIGHT_RULES = ["馬齢", "別定", "定量", "ハンデ"] as const;
export type WeightRule = (typeof WEIGHT_RULES)[number];

/** レース後に入る。予想時点では分からない。 */
export const TRACK_CONDITIONS = ["良", "稍重", "重", "不良"] as const;
export type TrackCondition = (typeof TRACK_CONDITIONS)[number];

/**
 * レース後に入る実際の天気。
 *
 * 予想時点の `weather_forecast`（「曇のち雨」）は自由記述なので、こちらでは縛らない。
 */
export const WEATHERS = ["晴", "曇", "小雨", "雨", "小雪", "雪"] as const;
export type Weather = (typeof WEATHERS)[number];

// ---------------------------------------------------------------------------
// horses / jockeys / trainers
// ---------------------------------------------------------------------------

export const SEXES = ["牡", "牝", "セン"] as const;
export type Sex = (typeof SEXES)[number];

/** 騎手・調教師で共通。地方と外国の騎乗・管理馬も対象に含めるため4つある。 */
export const AFFILIATIONS = ["美浦", "栗東", "地方", "外国"] as const;
export type Affiliation = (typeof AFFILIATIONS)[number];

// ---------------------------------------------------------------------------
// entries
// ---------------------------------------------------------------------------

export const ENTRY_STATUSES = ["出走", "取消", "除外", "中止", "失格"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

// ---------------------------------------------------------------------------
// 評価・予想の書き手
// ---------------------------------------------------------------------------

/** 評価8テーブル（`entry_notes` など）の `author`。 */
export const NOTE_AUTHORS = ["AI", "人間", "対話"] as const;
export type NoteAuthor = (typeof NOTE_AUTHORS)[number];

/**
 * `race_predictions` の `author`。
 *
 * 展開の予想は AI と人間が対話で考えるため、**人間のみは入らない**。
 * `NOTE_AUTHORS` の部分集合であることを `satisfies` で縛っている。
 */
export const RACE_PREDICTION_AUTHORS = ["AI", "対話"] as const satisfies readonly NoteAuthor[];
export type RacePredictionAuthor = (typeof RACE_PREDICTION_AUTHORS)[number];

// ---------------------------------------------------------------------------
// 購入
// ---------------------------------------------------------------------------

export const TICKET_TYPES = [
  "単勝",
  "複勝",
  "枠連",
  "馬連",
  "馬単",
  "ワイド",
  "3連複",
  "3連単",
  "WIN5",
] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

/**
 * レースの確定払戻に出てくる券種。
 *
 * **WIN5 が入らない**ぶんだけ `TICKET_TYPES` と違う。WIN5 は5レースをまたぐもので、
 * 1つのレースの払戻ではない（[data-model.md](../../docs/data-model.md#race_payouts)）。
 */
export const PAYOUT_TICKET_TYPES = TICKET_TYPES.filter(
  (type) => type !== "WIN5",
) as readonly Exclude<TicketType, "WIN5">[];
export type PayoutTicketType = (typeof PAYOUT_TICKET_TYPES)[number];

/** 人間が読むためのラベル。買い目の展開には使わない（docs/decisions/0003）。 */
export const BET_STYLES = ["単点", "ボックス", "流し", "フォーメーション"] as const;
export type BetStyle = (typeof BET_STYLES)[number];

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export const ACCESS_LEVELS = ["owner", "friend", "member", "public"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

/** 画面判定には使わない。将来 note のメンバー一覧を洗い替えるときの目印。 */
export const GRANT_SOURCES = ["owner", "manual", "note"] as const;
export type GrantSource = (typeof GRANT_SOURCES)[number];
