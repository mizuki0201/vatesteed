import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  ACCESS_LEVELS,
  AFFILIATIONS,
  BET_STYLES,
  COMMENT_RACE_PHASES,
  COMMENT_SPEAKER_ROLES,
  COURSE_LAYOUTS,
  ENTRY_STATUSES,
  GRADES,
  GRANT_SOURCES,
  MEMO_STATUSES,
  NOTE_AUTHORS,
  PAYOUT_TICKET_TYPES,
  RACE_PREDICTION_AUTHORS,
  SEXES,
  SURFACES,
  TICKET_TYPES,
  TRACK_CONDITIONS,
  TURNS,
  WEATHERS,
  WEIGHT_RULES,
} from "./enums.ts";

/**
 * `enums.ts` は DB の CHECK 制約の写しなので、放っておくと片方だけ直されてズレる。
 * ここで `db/schema.sql`（`pnpm db:migrate` が毎回書き出す現在のスキーマ）と突き合わせる。
 *
 * 突き合わせは両方向に見る。**DB に足した値を書き写し忘れた場合だけでなく、DB に無い
 * CHECK を TS 側が知っている場合も落とす。**
 */

const SCHEMA_PATH = new URL("../../db/schema.sql", import.meta.url);

/**
 * `db/schema.sql` から「その列に入っていい値」を読み出す。
 *
 * 拾うのは値の一覧そのものを縛る CHECK だけ。`ai_bets_multi_only_ordered` のように
 * 他の列との関係を縛る CHECK にも `ticket_type = ANY (ARRAY[...])` は現れるが、
 * それは「入っていい値」ではないので拾ってはいけない。`CHECK ((列 = ANY (ARRAY[…])))`
 * の形に**前後までぴったり合うもの**だけを見ることで分けている。
 *
 * @returns `テーブル名.列名` → 値の一覧
 */
function parseCheckedValues(sql: string): Map<string, string[]> {
  const found = new Map<string, string[]>();
  let table: string | null = null;

  for (const line of sql.split("\n")) {
    const createTable = line.match(/^CREATE TABLE (\w+) \($/);
    if (createTable) {
      table = createTable[1];
      continue;
    }
    if (line === ");") {
      table = null;
      continue;
    }
    if (table === null) continue;

    const check = line
      .trim()
      .replace(/,$/, "")
      .match(/^CONSTRAINT \w+ CHECK \(\((\w+) = ANY \(ARRAY\[(.+)\]\)\)\)$/);
    if (!check) continue;

    const [, column, array] = check;
    found.set(`${table}.${column}`, [...array.matchAll(/'([^']*)'::text/g)].map((m) => m[1]));
  }

  return found;
}

/** 評価8テーブル。どれも `author` の縛りは同じ。 */
const NOTE_TABLES = [
  "entry_notes",
  "horse_notes",
  "pedigree_notes",
  "progeny_notes",
  "jockey_notes",
  "trainer_notes",
  "course_notes",
  "race_notes",
];

/** `テーブル名.列名` → その列を縛っている定数。 */
const EXPECTED: Record<string, readonly string[]> = {
  "courses.surface": SURFACES,
  "courses.turn": TURNS,
  "courses.layout": COURSE_LAYOUTS,
  "races.grade": GRADES,
  "races.weight_rule": WEIGHT_RULES,
  "races.track_condition": TRACK_CONDITIONS,
  "races.weather": WEATHERS,
  "horses.sex": SEXES,
  "jockeys.affiliation": AFFILIATIONS,
  "trainers.affiliation": AFFILIATIONS,
  "entries.status": ENTRY_STATUSES,
  ...Object.fromEntries(NOTE_TABLES.map((table) => [`${table}.author`, NOTE_AUTHORS])),
  // コメントは評価ではないが、書いた人の縛りは評価8テーブルと同じ
  "entry_comments.author": NOTE_AUTHORS,
  "entry_comments.race_phase": COMMENT_RACE_PHASES,
  "entry_comments.speaker_role": COMMENT_SPEAKER_ROLES,
  // メモは評価ではないので author を持たない。縛るのは取り込みの状況だけ
  "memos.status": MEMO_STATUSES,
  "race_predictions.author": RACE_PREDICTION_AUTHORS,
  // 予想時点の前提は、人間だけが書くこともある（馬場を見た話が人間の側にしか無い場合）
  "race_prediction_conditions.author": NOTE_AUTHORS,
  "ai_bets.ticket_type": TICKET_TYPES,
  "race_payouts.ticket_type": PAYOUT_TICKET_TYPES,
  "my_bets.ticket_type": TICKET_TYPES,
  "ai_bets.bet_style": BET_STYLES,
  "my_bets.bet_style": BET_STYLES,
  "users.access_level": ACCESS_LEVELS,
  "users.grant_source": GRANT_SOURCES,
};

const found = parseCheckedValues(readFileSync(SCHEMA_PATH, "utf8"));

test("db/schema.sql の CHECK をすべて拾えている", () => {
  // 読み出しに失敗して0件になると、以下のテストが素通りしてしまうため件数を見ておく
  assert.equal(found.size, Object.keys(EXPECTED).length);
});

test("定数が db/schema.sql の CHECK と一致する", () => {
  for (const [key, values] of Object.entries(EXPECTED)) {
    const actual = found.get(key);
    assert.ok(actual, `${key} を縛る CHECK が db/schema.sql に見つかりません。`);

    // 並び順は縛らない。CHECK の値に順序の意味は無く、読みやすい順に並べ替えたいことがある
    assert.deepEqual([...actual].sort(), [...values].sort(), `${key} の値がズレています。`);
  }
});

test("db/schema.sql にあって定数に無い CHECK が無い", () => {
  for (const key of found.keys()) {
    assert.ok(key in EXPECTED, `${key} を縛る CHECK が lib/enums/ に写されていません。`);
  }
});
