import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { INTERNAL_TERMS, INTERNAL_TERM_PATTERN, findInternalTerms } from "./internal-terms.ts";

/** 弾かれたかどうかだけを見たいときの短縮。 */
function rejected(body: string): boolean {
  return findInternalTerms(body).length > 0;
}

describe("findInternalTerms", () => {
  describe("内部の作業情報が混ざった本文は弾く", () => {
    it("保存先が入っているかどうかを見る", () => {
      assert.deepEqual(findInternalTerms("DB に出走は1つも無い"), ["DB"]);
      assert.deepEqual(findInternalTerms("pedigree_notes が未登録"), ["pedigree_notes"]);
      assert.deepEqual(findInternalTerms("産駒の傾向は progeny_notes の担当"), ["progeny_notes"]);
    });

    it("役の名前と、役の間の受け渡しを見る", () => {
      assert.deepEqual(findInternalTerms("horse-analyst の担当なのでここには書かない"), ["-analyst"]);
      assert.deepEqual(findInternalTerms("オーケストレーターへ返す"), ["オーケストレーター"]);
    });

    it("列の名前と、列に入っている値の書き方を見る", () => {
      assert.deepEqual(findInternalTerms("sire_id が null"), ["_id", "null"]);
      assert.deepEqual(findInternalTerms("corner_positions が空だった"), ["corner_positions"]);
      assert.deepEqual(findInternalTerms("scope には6代と書いた"), ["scope"]);
    });

    it("複数入っていれば、一覧の並び順で重複なく返す", () => {
      const found = findInternalTerms("horse_notes と entry_notes の author が null、null のまま");

      assert.deepEqual(found, ["entry_notes", "horse_notes", "null", "author"]);
    });
  });

  describe("競馬の言葉で書いた本文は通す", () => {
    it("材料の少なさを競馬の言葉で書いた留保は通る", () => {
      assert.equal(rejected("重馬場は1回しか出走しておらず、適性は決められない"), false);
      assert.equal(
        rejected("産駒はまだ2世代しか出走しておらず、傾向と呼べる数ではない"),
        false,
      );
    });

    it("資料が食い違っていることを競馬の言葉で書いた留保は通る", () => {
      assert.equal(rejected("枠番は資料によって8番と12番で食い違うが、どちらも大外"), false);
    });

    it("競馬の側の「登録」は弾かない", () => {
      assert.equal(rejected("2013-12-23 に競走馬登録抹消"), false);
      assert.equal(rejected("母キャットクイルが未登録"), false);
      assert.equal(rejected("重賞への登録が無く、未登録のまま次走を迎える"), false);
    });

    it("「取れなかった」という言い方そのものは弾かない", () => {
      assert.equal(rejected("映像が取れなかったので、直線での不利は分からない"), false);
    });
  });

  describe("大文字小文字を区別する", () => {
    it("英字を含む馬名・競走名は通る", () => {
      assert.equal(rejected("父 Frankel の産駒は、欧州の芝で持続力を出している"), false);
      assert.equal(rejected("Prix de l'Arc de Triomphe に4回遠征している"), false);
    });

    it("書いたとおりの綴りだけを見る", () => {
      // 表に載っているのは小文字の `marks` `users` `verifier` だけ
      assert.equal(rejected("Marks"), false);
      assert.equal(rejected("Users"), false);
      assert.equal(rejected("Verifier"), false);
      assert.deepEqual(findInternalTerms("marks"), ["marks"]);
    });

    it("`null` は小文字と大文字の両方を弾き、カタカナは弾かない", () => {
      assert.deepEqual(findInternalTerms("null"), ["null"]);
      assert.deepEqual(findInternalTerms("NULL"), ["NULL"]);
      assert.equal(rejected("ヌル"), false);
      assert.equal(rejected("ヌーヴォレコルトは牝馬で連対を続けた"), false);
    });
  });

  it("何も入っていなければ空配列", () => {
    assert.deepEqual(findInternalTerms(""), []);
    assert.deepEqual(findInternalTerms("向正面で強引にハナを取り返して消耗した"), []);
  });
});

describe("INTERNAL_TERM_PATTERN", () => {
  it("一覧をそのまま `|` で繋いだもの", () => {
    assert.equal(INTERNAL_TERM_PATTERN, INTERNAL_TERMS.join("|"));
  });

  it("Postgres の `~` と `RegExp` で意味が変わる文字を含まない", () => {
    // リテラルの選択だけで書く。`-` は角括弧の外なので、どちらの方言でもただの文字
    for (const term of INTERNAL_TERMS) {
      assert.match(term, /^[-\w\p{Script=Katakana}ー]+$/u, `${term} に特別な意味を持つ文字がある`);
    }
  });

  it("`RegExp` に渡したときの判定が findInternalTerms と一致する", () => {
    const pattern = new RegExp(INTERNAL_TERM_PATTERN);

    for (const body of [
      "DB に出走は1つも無い",
      "sire_id が null",
      "重馬場は1回しか出走しておらず、適性は決められない",
      "母キャットクイルが未登録",
      "ヌーヴォレコルトは牝馬で連対を続けた",
    ]) {
      assert.equal(pattern.test(body), rejected(body), body);
    }
  });
});

/**
 * SQL 側の CHECK 制約は、この一覧を写したもの。**写し間違いと、片方だけの更新を防ぐ。**
 * ここがずれると、指示を直しても書ける状態が残る。
 */
describe("db/migrations/0011 とずれていない", () => {
  const sql = readFileSync(
    join(import.meta.dirname, "../../db/migrations/0011_notes_no_internal_terms.sql"),
    "utf8",
  );

  /** `body` に制約を張る評価テーブル。docs/data-model.md の評価8テーブル。 */
  const BODY_TABLES = [
    "entry_notes",
    "horse_notes",
    "pedigree_notes",
    "progeny_notes",
    "jockey_notes",
    "trainer_notes",
    "course_notes",
    "race_notes",
  ];

  /** `scope` を持つ2テーブル。ここも公開される保存値なので同じ制約が要る。 */
  const SCOPE_TABLES = ["pedigree_notes", "progeny_notes"];

  /** 制約の総数。8テーブルの `body` と、2テーブルの `scope`。 */
  const CONSTRAINT_COUNT = BODY_TABLES.length + SCOPE_TABLES.length;

  it("パターンが同じ文字列で入っている", () => {
    assert.ok(sql.includes(INTERNAL_TERM_PATTERN), "INTERNAL_TERM_PATTERN が SQL に見つからない");
  });

  it("8テーブルぶんの `body` の制約が揃っている", () => {
    for (const table of BODY_TABLES) {
      assert.ok(
        sql.includes(`ADD CONSTRAINT ${table}_body_no_internal_terms`),
        `${table} の body の制約が無い`,
      );
    }
  });

  it("`scope` を持つ2テーブルの制約が揃っている", () => {
    for (const table of SCOPE_TABLES) {
      assert.ok(
        sql.includes(`ADD CONSTRAINT ${table}_scope_no_internal_terms`),
        `${table} の scope の制約が無い`,
      );
    }
  });

  it("制約がちょうど10個ある", () => {
    assert.equal(sql.split("ADD CONSTRAINT ").length - 1, CONSTRAINT_COUNT);
  });

  it("パターンを書いた箇所がちょうど10回ある", () => {
    assert.equal(sql.split(INTERNAL_TERM_PATTERN).length - 1, CONSTRAINT_COUNT);
  });
});
