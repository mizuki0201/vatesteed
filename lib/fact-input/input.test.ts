import assert from "node:assert/strict";
import { test } from "node:test";
import { date, id, integer, text, todayInJapan } from "./fields.ts";
import {
  ENTRY_ROWS_MAX,
  looksOverseas,
  parseCourseInput,
  parseEntryRows,
  parseHorseInput,
  parseJockeyInput,
  parseNewHorseRetirement,
  parseRaceInput,
  parseTrainerInput,
} from "./input.ts";

const TODAY = "2026-09-17";

// ---------------------------------------------------------------------------
// 部品
// ---------------------------------------------------------------------------

test("空白だけの文字列と、欄が無いときは空として扱う", () => {
  assert.equal(text("  "), null);
  assert.equal(text(null), null);
  assert.equal(text(" 阪神 "), "阪神");
});

test("文字列でない値は正しくないとして扱う", () => {
  assert.equal(text({}), undefined);
  assert.equal(id(new Blob()), undefined);
});

test("ID は先頭が0でない数字だけを受け付ける", () => {
  assert.equal(id("12"), "12");
  assert.equal(id(12), "12");
  assert.equal(id("012"), undefined);
  assert.equal(id("1; DROP"), undefined);
});

test("整数は範囲の外と小数を弾く", () => {
  assert.equal(integer("8", { min: 1, max: 8 }), 8);
  assert.equal(integer("9", { min: 1, max: 8 }), undefined);
  assert.equal(integer("1.5", { min: 1, max: 8 }), undefined);
});

test("日付は実在しないものと範囲の外を弾く", () => {
  assert.equal(date("2026-02-28"), "2026-02-28");
  assert.equal(date("2026-02-30"), undefined);
  assert.equal(date("2026-09-18", { max: TODAY }), undefined);
});

test("日本時間の今日は、UTC で前日の15時以降なら翌日になる", () => {
  assert.equal(todayInJapan(new Date("2026-09-16T15:00:00Z")), "2026-09-17");
  assert.equal(todayInJapan(new Date("2026-09-16T14:59:59Z")), "2026-09-16");
});

// ---------------------------------------------------------------------------
// コース
// ---------------------------------------------------------------------------

test("コースは内外が空なら null で通す", () => {
  const result = parseCourseInput({
    track: "盛岡",
    surface: "ダート",
    distanceM: "1600",
    turn: "左",
    layout: "",
  });

  assert.deepEqual(result, {
    ok: true,
    value: { track: "盛岡", surface: "ダート", distanceM: 1600, turn: "左", layout: null },
  });
});

test("コースは馬場の種類が決まった値でなければ弾く", () => {
  const result = parseCourseInput({ track: "大井", surface: "砂", distanceM: "2000", turn: "右" });

  assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// 騎手・厩舎
// ---------------------------------------------------------------------------

test("騎手は名前だけでも登録できる", () => {
  const result = parseJockeyInput({ name: "武豊" });

  assert.deepEqual(result, {
    ok: true,
    value: { name: "武豊", nameKana: null, birthYear: null, debutYear: null, affiliation: null },
  });
});

test("騎手の所属は決まった値でなければ弾く", () => {
  assert.equal(parseJockeyInput({ name: "武豊", affiliation: "関西" }).ok, false);
});

test("厩舎の開業日は今日より後を弾く", () => {
  assert.equal(parseTrainerInput({ name: "友道康夫", openedOn: "2026-09-18" }, TODAY).ok, false);
  assert.equal(parseTrainerInput({ name: "友道康夫", openedOn: "2002-03-01" }, TODAY).ok, true);
});

// ---------------------------------------------------------------------------
// 馬
// ---------------------------------------------------------------------------

test("馬名に英字が入っていれば海外の初期値にする", () => {
  assert.equal(looksOverseas("Romantic Warrior"), true);
  assert.equal(looksOverseas("リプリートII"), true);
  assert.equal(looksOverseas("メイショウタバル"), false);
});

test("馬は父と母に同じ馬を選べない", () => {
  const result = parseHorseInput({ name: "テスト", sireId: "5", damId: "5" });

  assert.equal(result.ok, false);
});

test("馬の海外の欄は、チェックされたときだけ true になる", () => {
  const checked = parseHorseInput({ name: "Test", isOverseas: "on" });
  const unchecked = parseHorseInput({ name: "Test" });

  assert.equal(checked.ok && checked.value.isOverseas, true);
  assert.equal(unchecked.ok && unchecked.value.isOverseas, false);
});

test("馬を作るとき、引退にチェックが無ければ引退日を見ない", () => {
  const result = parseNewHorseRetirement({ retiredOn: "壊れた値" }, false, TODAY);

  assert.deepEqual(result, { ok: true, value: { retired: false } });
});

test("馬を作るとき、引退日が空なら日付不明として返す", () => {
  const result = parseNewHorseRetirement({ retired: "on", retiredOn: "" }, false, TODAY);

  assert.deepEqual(result, { ok: true, value: { retired: true, retiredOn: null } });
});

test("海外の馬は、引退にチェックがあっても引退にしない", () => {
  const result = parseNewHorseRetirement({ retired: "on", retiredOn: "2020-01-01" }, true, TODAY);

  assert.deepEqual(result, { ok: true, value: { retired: false } });
});

test("馬を作るとき、1900-01-01 より前と今日より後の引退日を弾く", () => {
  assert.equal(parseNewHorseRetirement({ retired: "on", retiredOn: "1899-12-31" }, false, TODAY).ok, false);
  assert.equal(parseNewHorseRetirement({ retired: "on", retiredOn: "2026-09-18" }, false, TODAY).ok, false);
});

// ---------------------------------------------------------------------------
// レース
// ---------------------------------------------------------------------------

test("レース名は表記ルールに合わせて半角にし、空白を取る", () => {
  const result = parseRaceInput({ raceDate: "2026-05-03", courseId: "3", raceName: "天皇賞 （春）" });

  assert.equal(result.ok && result.value.raceName, "天皇賞(春)");
});

test("レース名が空なら null にする", () => {
  const result = parseRaceInput({ raceDate: "2026-05-03", courseId: "3", raceName: "" });

  assert.equal(result.ok && result.value.raceName, null);
});

test("レースは日付とコースが無ければ弾く", () => {
  assert.equal(parseRaceInput({ courseId: "3" }).ok, false);
  assert.equal(parseRaceInput({ raceDate: "2026-05-03" }).ok, false);
});

test("レースの格は決まった値でなければ弾く", () => {
  assert.equal(parseRaceInput({ raceDate: "2026-05-03", courseId: "3", grade: "GI" }).ok, false);
});

// ---------------------------------------------------------------------------
// 出走
// ---------------------------------------------------------------------------

const ROW = { horseId: "10", jockeyId: "20", bracketNumber: "1", horseNumber: "1", weightCarried: "57", status: "" };

test("出走の取消・除外が空なら出走として扱う", () => {
  const result = parseEntryRows([ROW]);

  assert.deepEqual(result, {
    ok: true,
    value: [
      {
        entryId: null,
        horseId: "10",
        jockeyId: "20",
        bracketNumber: 1,
        horseNumber: 1,
        weightCarried: "57",
        status: "出走",
      },
    ],
  });
});

test("出走は馬が選ばれていない行を弾く", () => {
  assert.equal(parseEntryRows([{ ...ROW, horseId: "" }]).ok, false);
});

test("出走は同じ馬が2行あると弾く", () => {
  assert.equal(parseEntryRows([ROW, { ...ROW, horseNumber: "2" }]).ok, false);
});

test("出走は馬番の重複を弾くが、馬番が空の行どうしは重複にしない", () => {
  assert.equal(parseEntryRows([ROW, { ...ROW, horseId: "11" }]).ok, false);
  assert.equal(
    parseEntryRows([
      { ...ROW, horseNumber: "" },
      { ...ROW, horseId: "11", horseNumber: "" },
    ]).ok,
    true,
  );
});

test("出走の枠番は1〜8の外を弾く", () => {
  assert.equal(parseEntryRows([{ ...ROW, bracketNumber: "9" }]).ok, false);
});

test("斤量は小数1桁までを受け付ける", () => {
  assert.equal(parseEntryRows([{ ...ROW, weightCarried: "55.5" }]).ok, true);
  assert.equal(parseEntryRows([{ ...ROW, weightCarried: "55.25" }]).ok, false);
  assert.equal(parseEntryRows([{ ...ROW, weightCarried: "0" }]).ok, false);
});

test("出走は行数の上限を超えると弾く", () => {
  const rows = Array.from({ length: ENTRY_ROWS_MAX + 1 }, (_, index) => ({
    ...ROW,
    horseId: String(index + 1),
    horseNumber: "",
  }));

  assert.equal(parseEntryRows(rows).ok, false);
});

test("出走の行が配列でなければ弾く", () => {
  assert.equal(parseEntryRows({}).ok, false);
});
