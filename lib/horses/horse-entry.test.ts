import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toHorseEntry } from "./horse-entry.ts";

/** DB が返す1行のうち、評価以外の列。テストごとに評価の列だけを足す。 */
const row = {
  id: 477,
  race_id: 147,
  race_date: "2026-05-23",
  race_name: "カーネーションカップ",
  grade: "L",
  track: "東京",
  surface: "芝",
  distance_m: 1800,
  finish_position: 3,
  popularity: 2,
  status: "確定",
  jockey_name: "戸崎圭太",
  corner_positions: "5-5-4",
};

describe("toHorseEntry", () => {
  it("2種類の評価を別々に返す", () => {
    const entry = toHorseEntry({
      ...row,
      entry_note_body: "この馬は外を回された",
      entry_note_author: "AI",
      race_note_body: "前が止まらないレースだった",
      race_note_author: "対話",
    });

    assert.deepEqual(entry.entryNote, { body: "この馬は外を回された", author: "AI" });
    assert.deepEqual(entry.raceNote, { body: "前が止まらないレースだった", author: "対話" });
  });

  it("レース全体の分析だけがあるとき、出走の評価は無いまま返す", () => {
    const entry = toHorseEntry({
      ...row,
      entry_note_body: null,
      entry_note_author: null,
      race_note_body: "前が止まらないレースだった",
      race_note_author: "AI",
    });

    assert.equal(entry.entryNote, null);
    assert.deepEqual(entry.raceNote, { body: "前が止まらないレースだった", author: "AI" });
  });

  it("出走の評価だけがあるとき、レース全体の分析は無いまま返す", () => {
    const entry = toHorseEntry({
      ...row,
      entry_note_body: "この馬は外を回された",
      entry_note_author: "AI",
      race_note_body: null,
      race_note_author: null,
    });

    assert.deepEqual(entry.entryNote, { body: "この馬は外を回された", author: "AI" });
    assert.equal(entry.raceNote, null);
  });

  it("どちらも無いとき、両方とも無いまま返す", () => {
    const entry = toHorseEntry({
      ...row,
      entry_note_body: null,
      entry_note_author: null,
      race_note_body: null,
      race_note_author: null,
    });

    assert.equal(entry.entryNote, null);
    assert.equal(entry.raceNote, null);
  });

  it("レースと出走の内容を画面が使う形に直す", () => {
    const entry = toHorseEntry(row);

    assert.equal(entry.id, "477");
    assert.equal(entry.raceId, "147");
    assert.equal(entry.raceDate, "2026-05-23");
    assert.equal(entry.raceName, "カーネーションカップ");
    assert.equal(entry.grade, "L");
    assert.equal(entry.track, "東京");
    assert.equal(entry.surface, "芝");
    assert.equal(entry.distanceM, 1800);
    assert.equal(entry.finishPosition, 3);
    assert.equal(entry.popularity, 2);
    assert.equal(entry.status, "確定");
    assert.equal(entry.jockeyName, "戸崎圭太");
    assert.equal(entry.cornerPositions, "5-5-4");
  });

  it("埋まっていない列は null にする", () => {
    const entry = toHorseEntry({
      ...row,
      race_name: null,
      grade: null,
      finish_position: null,
      popularity: null,
      jockey_name: null,
      corner_positions: null,
    });

    assert.equal(entry.raceName, null);
    assert.equal(entry.grade, null);
    assert.equal(entry.finishPosition, null);
    assert.equal(entry.popularity, null);
    assert.equal(entry.jockeyName, null);
    assert.equal(entry.cornerPositions, null);
  });
});
