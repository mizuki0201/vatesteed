import { query } from "../db/index.ts";
import { assertCan } from "../access/index.ts";

/**
 * レースの画面が読むもの。
 *
 * **`assertCan()` を通してから SQL を投げる。** 画面側で判定を書き忘れても、ここで止まる
 * （[docs/architecture.md](../../docs/architecture.md)）。
 *
 * ID は `bigserial` なので、DB からは文字列で返る。URL でもそのまま文字列として扱う。
 */

export type RaceSummary = {
  readonly id: string;
  readonly raceDate: string;
  readonly raceName: string | null;
  readonly raceNumber: number | null;
  readonly grade: string | null;
  readonly track: string;
  readonly surface: string;
  readonly distanceM: number;
  readonly entryCount: string;
  readonly hasPrediction: boolean;
  readonly hasResult: boolean;
};

export type RaceDetail = {
  readonly id: string;
  readonly raceDate: string;
  readonly raceName: string | null;
  readonly raceNumber: number | null;
  readonly grade: string | null;
  readonly weightRule: string | null;
  readonly trackCondition: string | null;
  readonly weather: string | null;
  readonly weatherForecast: string | null;
  readonly courseId: string;
  readonly track: string;
  readonly surface: string;
  readonly distanceM: number;
  readonly turn: string;
  readonly layout: string | null;
  readonly prediction: { readonly body: string; readonly author: string } | null;
  readonly note: { readonly body: string; readonly author: string } | null;
};

export type RaceEntry = {
  readonly id: string;
  readonly bracketNumber: number | null;
  readonly horseNumber: number | null;
  readonly weightCarried: string | null;
  readonly status: string;
  readonly finishPosition: number | null;
  readonly popularity: number | null;
  readonly winOdds: string | null;
  readonly cornerPositions: string | null;
  readonly finishTimeMs: number | null;
  readonly last3fMs: number | null;
  readonly margin: string | null;
  readonly bodyWeight: number | null;
  readonly bodyWeightDiff: number | null;
  readonly horseId: string;
  readonly horseName: string;
  readonly sex: string | null;
  readonly birthYear: number | null;
  readonly jockeyId: string | null;
  readonly jockeyName: string | null;
  readonly trainerId: string | null;
  readonly trainerName: string | null;
  readonly markSymbol: string | null;
  readonly markName: string | null;
  readonly rationale: string | null;
  readonly entryNote: string | null;
  readonly entryNoteAuthor: string | null;
  readonly horseNote: string | null;
  readonly horseNoteAuthor: string | null;
};

export type RaceBet = {
  readonly id: string;
  readonly ticketType: string;
  readonly betStyle: string;
  readonly isMulti: boolean;
  readonly unitAmount: number;
  readonly combinationCount: number;
  readonly totalAmount: number;
  readonly payout: number | null;
  readonly refund: number | null;
  readonly legs: readonly RaceBetLeg[];
};

export type RaceBetLeg = {
  readonly legGroup: number;
  readonly horseNumber: number | null;
  readonly horseName: string | null;
  readonly bracketNumber: number | null;
};

/** 一覧。`q` を渡すとレース名・競馬場名の部分一致で絞る。 */
export async function listRaces(options: { readonly q?: string } = {}): Promise<
  readonly RaceSummary[]
> {
  await assertCan("races");

  const q = options.q?.trim();

  const { rows } = await query(
    `SELECT r.id, r.race_date, r.race_name, r.race_number, r.grade,
            c.track, c.surface, c.distance_m,
            (SELECT count(*) FROM entries e WHERE e.race_id = r.id) AS entry_count,
            EXISTS (SELECT 1 FROM race_predictions p WHERE p.race_id = r.id) AS has_prediction,
            EXISTS (SELECT 1 FROM entries e WHERE e.race_id = r.id AND e.finish_position IS NOT NULL) AS has_result
       FROM races r
       JOIN courses c ON c.id = r.course_id
      WHERE $1::text IS NULL
         OR r.race_name ILIKE '%' || $1 || '%'
         OR c.track ILIKE '%' || $1 || '%'
      ORDER BY r.race_date DESC, r.race_number NULLS LAST
      LIMIT 200`,
    [q || null],
  );

  return rows.map((row) => ({
    id: String(row.id),
    raceDate: String(row.race_date),
    raceName: (row.race_name as string | null) ?? null,
    raceNumber: (row.race_number as number | null) ?? null,
    grade: (row.grade as string | null) ?? null,
    track: String(row.track),
    surface: String(row.surface),
    distanceM: Number(row.distance_m),
    entryCount: String(row.entry_count),
    hasPrediction: Boolean(row.has_prediction),
    hasResult: Boolean(row.has_result),
  }));
}

/** レース1枚ぶんの土台。見つからなければ `undefined`。 */
export async function getRace(id: string): Promise<RaceDetail | undefined> {
  await assertCan("races");

  const { rows } = await query(
    `SELECT r.id, r.race_date, r.race_name, r.race_number, r.grade, r.weight_rule,
            r.track_condition, r.weather, r.weather_forecast,
            c.id AS course_id, c.track, c.surface, c.distance_m, c.turn, c.layout,
            p.body AS prediction_body, p.author AS prediction_author,
            n.body AS note_body, n.author AS note_author
       FROM races r
       JOIN courses c ON c.id = r.course_id
       LEFT JOIN race_predictions p ON p.race_id = r.id
       LEFT JOIN race_notes n ON n.race_id = r.id
      WHERE r.id = $1`,
    [id],
  );

  const row = rows[0];
  if (!row) return undefined;

  return {
    id: String(row.id),
    raceDate: String(row.race_date),
    raceName: (row.race_name as string | null) ?? null,
    raceNumber: (row.race_number as number | null) ?? null,
    grade: (row.grade as string | null) ?? null,
    weightRule: (row.weight_rule as string | null) ?? null,
    trackCondition: (row.track_condition as string | null) ?? null,
    weather: (row.weather as string | null) ?? null,
    weatherForecast: (row.weather_forecast as string | null) ?? null,
    courseId: String(row.course_id),
    track: String(row.track),
    surface: String(row.surface),
    distanceM: Number(row.distance_m),
    turn: String(row.turn),
    layout: (row.layout as string | null) ?? null,
    prediction: row.prediction_body
      ? { body: String(row.prediction_body), author: String(row.prediction_author) }
      : null,
    note: row.note_body ? { body: String(row.note_body), author: String(row.note_author) } : null,
  };
}

/** 出走の一覧。印の順（無印は最後）、同じなら馬番の順に並べる。 */
export async function listRaceEntries(raceId: string): Promise<readonly RaceEntry[]> {
  await assertCan("races");

  const { rows } = await query(
    `SELECT e.id, e.bracket_number, e.horse_number, e.weight_carried, e.status,
            e.finish_position, e.popularity, e.win_odds, e.corner_positions,
            e.finish_time_ms, e.last_3f_ms, e.margin, e.body_weight, e.body_weight_diff,
            h.id AS horse_id, h.name AS horse_name, h.sex, h.birth_year,
            j.id AS jockey_id, j.name AS jockey_name,
            t.id AS trainer_id, t.name AS trainer_name,
            m.symbol AS mark_symbol, m.name AS mark_name, m.sort_order AS mark_sort,
            p.rationale,
            en.body AS entry_note, en.author AS entry_note_author,
            hn.body AS horse_note, hn.author AS horse_note_author
       FROM entries e
       JOIN horses h ON h.id = e.horse_id
       LEFT JOIN jockeys j ON j.id = e.jockey_id
       LEFT JOIN trainers t ON t.id = e.trainer_id
       LEFT JOIN ai_predictions p ON p.entry_id = e.id
       LEFT JOIN marks m ON m.id = p.mark_id
       LEFT JOIN entry_notes en ON en.entry_id = e.id
       LEFT JOIN horse_notes hn ON hn.horse_id = h.id
      WHERE e.race_id = $1
      ORDER BY coalesce(m.sort_order, 9999), e.horse_number NULLS LAST, h.name`,
    [raceId],
  );

  return rows.map(toRaceEntry);
}

function toRaceEntry(row: Record<string, unknown>): RaceEntry {
  return {
    id: String(row.id),
    bracketNumber: (row.bracket_number as number | null) ?? null,
    horseNumber: (row.horse_number as number | null) ?? null,
    weightCarried: row.weight_carried === null ? null : String(row.weight_carried),
    status: String(row.status),
    finishPosition: (row.finish_position as number | null) ?? null,
    popularity: (row.popularity as number | null) ?? null,
    winOdds: row.win_odds === null ? null : String(row.win_odds),
    cornerPositions: (row.corner_positions as string | null) ?? null,
    finishTimeMs: (row.finish_time_ms as number | null) ?? null,
    last3fMs: (row.last_3f_ms as number | null) ?? null,
    margin: (row.margin as string | null) ?? null,
    bodyWeight: (row.body_weight as number | null) ?? null,
    bodyWeightDiff: (row.body_weight_diff as number | null) ?? null,
    horseId: String(row.horse_id),
    horseName: String(row.horse_name),
    sex: (row.sex as string | null) ?? null,
    birthYear: (row.birth_year as number | null) ?? null,
    jockeyId: row.jockey_id === null ? null : String(row.jockey_id),
    jockeyName: (row.jockey_name as string | null) ?? null,
    trainerId: row.trainer_id === null ? null : String(row.trainer_id),
    trainerName: (row.trainer_name as string | null) ?? null,
    markSymbol: (row.mark_symbol as string | null) ?? null,
    markName: (row.mark_name as string | null) ?? null,
    rationale: (row.rationale as string | null) ?? null,
    entryNote: (row.entry_note as string | null) ?? null,
    entryNoteAuthor: (row.entry_note_author as string | null) ?? null,
    horseNote: (row.horse_note as string | null) ?? null,
    horseNoteAuthor: (row.horse_note_author as string | null) ?? null,
  };
}

export type RacePayout = {
  readonly ticketType: string;
  readonly combination: string;
  readonly amount: number;
  readonly popularity: number | null;
};

/**
 * そのレースの確定払戻。**券種の並びは JRA の発表と同じ順**にする。
 *
 * DB の並び順は入れた順なので、こちらで並べ替える。人が見慣れた順でないと探しにくい。
 */
const TICKET_ORDER = [
  "単勝",
  "複勝",
  "枠連",
  "馬連",
  "ワイド",
  "馬単",
  "3連複",
  "3連単",
] as const;

export async function listRacePayouts(raceId: string): Promise<readonly RacePayout[]> {
  await assertCan("races");

  const { rows } = await query(
    `SELECT ticket_type, combination, amount, popularity
       FROM race_payouts
      WHERE race_id = $1`,
    [raceId],
  );

  return rows
    .map((row) => ({
      ticketType: String(row.ticket_type),
      combination: String(row.combination),
      amount: Number(row.amount),
      popularity: (row.popularity as number | null) ?? null,
    }))
    .sort((a, b) => {
      const order =
        TICKET_ORDER.indexOf(a.ticketType as (typeof TICKET_ORDER)[number]) -
        TICKET_ORDER.indexOf(b.ticketType as (typeof TICKET_ORDER)[number]);

      return order !== 0 ? order : a.combination.localeCompare(b.combination);
    });
}

/** そのレースの買い目。列（`ai_bet_legs`）も一緒に組み立てて返す。 */
export async function listRaceBets(raceId: string): Promise<readonly RaceBet[]> {
  await assertCan("races");

  const [bets, legs] = await Promise.all([
    query(
      `SELECT id, ticket_type, bet_style, is_multi, unit_amount, combination_count,
              total_amount, payout, refund
         FROM ai_bets
        WHERE race_id = $1
        ORDER BY id`,
      [raceId],
    ),
    query(
      `SELECT l.ai_bet_id, l.leg_group, l.bracket_number, e.horse_number, h.name AS horse_name
         FROM ai_bet_legs l
         JOIN ai_bets b ON b.id = l.ai_bet_id
         LEFT JOIN entries e ON e.id = l.entry_id
         LEFT JOIN horses h ON h.id = e.horse_id
        WHERE b.race_id = $1
        ORDER BY l.leg_group, e.horse_number NULLS LAST`,
      [raceId],
    ),
  ]);

  return bets.rows.map((row) => ({
    id: String(row.id),
    ticketType: String(row.ticket_type),
    betStyle: String(row.bet_style),
    isMulti: Boolean(row.is_multi),
    unitAmount: Number(row.unit_amount),
    combinationCount: Number(row.combination_count),
    totalAmount: Number(row.total_amount),
    payout: row.payout === null ? null : Number(row.payout),
    refund: row.refund === null ? null : Number(row.refund),
    legs: legs.rows
      .filter((leg) => String(leg.ai_bet_id) === String(row.id))
      .map((leg) => ({
        legGroup: Number(leg.leg_group),
        horseNumber: (leg.horse_number as number | null) ?? null,
        horseName: (leg.horse_name as string | null) ?? null,
        bracketNumber: (leg.bracket_number as number | null) ?? null,
      })),
  }));
}
