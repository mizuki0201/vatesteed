import assert from "node:assert/strict";
import { test } from "node:test";
import { ANALYSIS_RESULT_TABLES, assertRacingModeAllows } from "./racing-mode.ts";

test("読み取りは常に通す", () => {
  for (const sqlText of [
    "SELECT * FROM entries WHERE race_id = $1",
    "select id from horses",
    "\n  -- 出走を数える\n  SELECT count(*) FROM entries",
    "WITH latest AS (SELECT * FROM entry_notes) SELECT * FROM latest",
    "(SELECT 1) UNION (SELECT 2)",
    "TABLE marks",
    "EXPLAIN SELECT * FROM races",
  ]) {
    assert.doesNotThrow(() => assertRacingModeAllows(sqlText), sqlText);
  }
});

test("分析結果のテーブルへの更新は通す", () => {
  for (const sqlText of [
    "INSERT INTO entry_notes (entry_id, body, author) VALUES ($1, $2, 'AI')",
    "UPDATE horse_notes SET body = $2 WHERE horse_id = $1",
    "DELETE FROM ai_bet_legs WHERE ai_bet_id = $1",
    "insert into pedigree_notes (horse_id, body, scope, author) values ($1, $2, $3, 'AI')",
  ]) {
    assert.doesNotThrow(() => assertRacingModeAllows(sqlText), sqlText);
  }
});

test("ON CONFLICT ... DO UPDATE の形も通す", () => {
  // 評価を書くときの決まった形。`DO UPDATE` を更新の始まりと取り違えない
  const sqlText = [
    "INSERT INTO entry_notes (entry_id, body, author) VALUES ($1, $2, 'AI')",
    "ON CONFLICT (entry_id) DO UPDATE SET body = EXCLUDED.body, author = 'AI'",
    "WHERE entry_notes.author = 'AI'",
    "RETURNING id;",
  ].join("\n");

  assert.doesNotThrow(() => assertRacingModeAllows(sqlText));
});

test("事実データのテーブルは更新できない", () => {
  for (const sqlText of [
    "INSERT INTO horses (name) VALUES ($1)",
    "INSERT INTO entries (race_id, horse_id) VALUES ($1, $2)",
    "UPDATE races SET weather = $2 WHERE id = $1",
    "UPDATE entries SET finish_position = $2 WHERE id = $1",
    "DELETE FROM race_laps WHERE race_id = $1",
    "INSERT INTO entry_comments (entry_id, summary) VALUES ($1, $2)",
    "INSERT INTO race_payouts (race_id, combination) VALUES ($1, $2)",
    "UPDATE memos SET status = $2 WHERE id = $1",
    "INSERT INTO my_predictions (entry_id, mark_id, predicted_at) VALUES ($1, $2, now())",
  ]) {
    assert.throws(() => assertRacingModeAllows(sqlText), /更新できません/, sqlText);
  }
});

test("拒否したときは、進行役へ返す先を伝える", () => {
  assert.throws(() => assertRacingModeAllows("UPDATE races SET weather = $2 WHERE id = $1"), (error: Error) => {
    assert.match(error.message, /races/);
    assert.match(error.message, /未登録・未分析/);
    assert.match(error.message, /entry_notes/);
    return true;
  });
});

test("印の一覧そのものは事実なので更新できない", () => {
  // `marks` は印の種類のマスタ。分析結果は `ai_predictions` の側に入る
  assert.throws(() => assertRacingModeAllows("UPDATE marks SET symbol = $2 WHERE id = $1"), /marks/);
  assert.doesNotThrow(() =>
    assertRacingModeAllows("INSERT INTO ai_predictions (entry_id, mark_id, predicted_at) VALUES ($1, $2, now())"),
  );
});

test("読み取りでも分析結果の更新でもない文は通さない", () => {
  for (const sqlText of [
    "SET search_path TO public",
    "COPY entries FROM STDIN",
    "TRUNCATE entry_notes",
  ]) {
    assert.throws(() => assertRacingModeAllows(sqlText), /実行できません/, sqlText);
  }
});

test("読み取りの中に混ぜた更新も見つける", () => {
  const sqlText =
    "WITH removed AS (DELETE FROM entries WHERE id = $1 RETURNING id) SELECT * FROM removed";

  assert.throws(() => assertRacingModeAllows(sqlText), /entries/);
});

test("コメントや本文の中の言葉を更新と取り違えない", () => {
  assert.doesNotThrow(() =>
    assertRacingModeAllows("-- entries を update する話ではない\nSELECT * FROM entries"),
  );
  assert.doesNotThrow(() =>
    assertRacingModeAllows("SELECT * FROM entries WHERE id = $1 /* insert into horses */"),
  );
  assert.doesNotThrow(() =>
    assertRacingModeAllows("SELECT 'insert into horses' AS body FROM entries"),
  );
});

test("スキーマ名や引用符を付けて書いても更新先を見る", () => {
  assert.throws(() => assertRacingModeAllows('UPDATE public."horses" SET name = $1'), /horses/);
  assert.doesNotThrow(() => assertRacingModeAllows('UPDATE public."horse_notes" SET body = $1'));
});

test("更新先を読み取れない文は通さない", () => {
  assert.throws(() => assertRacingModeAllows("INSERT horse_notes VALUES ($1)"), /読み取れない/);
});

test("分析結果のテーブルの一覧に事実データを入れない", () => {
  for (const table of [
    "courses",
    "races",
    "horses",
    "jockeys",
    "trainers",
    "entries",
    "entry_comments",
    "race_laps",
    "race_payouts",
    "memos",
    "marks",
    "users",
    "my_bets",
    "my_bet_legs",
    "my_predictions",
  ]) {
    assert.equal(ANALYSIS_RESULT_TABLES.has(table), false, table);
  }
});
