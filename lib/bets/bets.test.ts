import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countRunners,
  expandBet,
  isHit,
  placeLimit,
  recoveryRate,
  type BetInput,
  type EntryResult,
  type EntryStatus,
} from "./bets.ts";

/** 点数だけ見たいときの短縮。 */
function count(input: Omit<BetInput, "unitAmount">): number {
  return expandBet({ ...input, unitAmount: 100 }).combinationCount;
}

function entry(
  entryId: number,
  bracketNumber: number,
  finishPosition: number | null,
  status: EntryStatus = "出走",
): EntryResult {
  return { entryId, bracketNumber, status, finishPosition };
}

/** 8頭立て。着順は馬番と同じ */
const plain = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => entry(n, n, n));

describe("expandBet", () => {
  describe("列から組み合わせを作る", () => {
    it("3連複フォーメーション 1-2,3-2,3,4,5,6 は7点", () => {
      // docs/data-model.md に書いてある例
      assert.equal(
        count({
          ticketType: "3連複",
          betStyle: "フォーメーション",
          isMulti: false,
          legs: [[1], [2, 3], [2, 3, 4, 5, 6]],
        }),
        7,
      );
    });

    it("ボックスは全列に同じ顔ぶれを入れて表す", () => {
      assert.equal(
        count({
          ticketType: "馬連",
          betStyle: "ボックス",
          isMulti: false,
          legs: [[1, 2, 3], [1, 2, 3]],
        }),
        3,
      );
      assert.equal(
        count({
          ticketType: "3連複",
          betStyle: "ボックス",
          isMulti: false,
          legs: [
            [1, 2, 3, 4],
            [1, 2, 3, 4],
            [1, 2, 3, 4],
          ],
        }),
        4,
      );
      assert.equal(
        count({
          ticketType: "3連単",
          betStyle: "ボックス",
          isMulti: false,
          legs: [
            [1, 2, 3],
            [1, 2, 3],
            [1, 2, 3],
          ],
        }),
        6,
      );
    });

    it("軸1頭流しは相手の列を必要な本数ぶん重ねて表す", () => {
      assert.equal(
        count({
          ticketType: "3連複",
          betStyle: "流し",
          isMulti: false,
          legs: [[1], [2, 3, 4, 5], [2, 3, 4, 5]],
        }),
        6,
      );
    });

    it("順不同の券種は顔ぶれが同じものを1点にまとめる", () => {
      const { combinations } = expandBet({
        ticketType: "馬連",
        betStyle: "フォーメーション",
        isMulti: false,
        legs: [
          [1, 2],
          [1, 2],
        ],
        unitAmount: 100,
      });
      assert.deepEqual(combinations, [[1, 2]]);
    });

    it("順序を問う券種はまとめない", () => {
      const { combinations } = expandBet({
        ticketType: "馬単",
        betStyle: "フォーメーション",
        isMulti: false,
        legs: [
          [1, 2],
          [1, 2],
        ],
        unitAmount: 100,
      });
      assert.deepEqual(combinations, [
        [1, 2],
        [2, 1],
      ]);
    });
  });

  describe("同じ馬の重複", () => {
    it("同じ馬が2回出る組み合わせは捨てる", () => {
      // 直積は4通りだが (1,1) と (2,2) が落ちる
      assert.equal(
        count({
          ticketType: "馬連",
          betStyle: "フォーメーション",
          isMulti: false,
          legs: [
            [1, 2],
            [1, 2],
          ],
        }),
        1,
      );
    });

    it("枠連にはゾロ目があるので捨てない", () => {
      const { combinations } = expandBet({
        ticketType: "枠連",
        betStyle: "フォーメーション",
        isMulti: false,
        legs: [[1], [1, 2, 3]],
        unitAmount: 100,
      });
      assert.deepEqual(combinations, [
        [1, 1],
        [1, 2],
        [1, 3],
      ]);
    });

    it("枠連でもボックスならゾロ目を作らない", () => {
      assert.equal(
        count({
          ticketType: "枠連",
          betStyle: "ボックス",
          isMulti: false,
          legs: [
            [1, 2, 3],
            [1, 2, 3],
          ],
        }),
        3,
      );
    });
  });

  describe("マルチ", () => {
    it("3連単の軸1頭流しマルチは並べ替えを全部加える", () => {
      assert.equal(
        count({
          ticketType: "3連単",
          betStyle: "流し",
          isMulti: true,
          legs: [[1], [2, 3], [2, 3]],
        }),
        6,
      );
    });

    it("馬単のマルチは表裏の2点になる", () => {
      const { combinations } = expandBet({
        ticketType: "馬単",
        betStyle: "単点",
        isMulti: true,
        legs: [[1], [2]],
        unitAmount: 100,
      });
      assert.deepEqual(combinations, [
        [1, 2],
        [2, 1],
      ]);
    });
  });

  describe("点数と金額", () => {
    it("金額は1点あたり × 点数", () => {
      const { combinationCount, totalAmount } = expandBet({
        ticketType: "馬連",
        betStyle: "ボックス",
        isMulti: false,
        legs: [
          [1, 2, 3],
          [1, 2, 3],
        ],
        unitAmount: 200,
      });
      assert.equal(combinationCount, 3);
      assert.equal(totalAmount, 600);
    });
  });

  describe("WIN5", () => {
    it("5列を使い、レースをまたぐので重複の除去は効かない", () => {
      assert.equal(
        count({
          ticketType: "WIN5",
          betStyle: "フォーメーション",
          isMulti: false,
          legs: [[1], [2], [3], [4], [5, 6]],
        }),
        2,
      );
    });
  });

  describe("入力の検証", () => {
    it("列の本数が券種と合わないと落とす", () => {
      assert.throws(
        () => count({ ticketType: "3連複", betStyle: "単点", isMulti: false, legs: [[1], [2]] }),
        /3 本必要/,
      );
    });

    it("空の列があると落とす", () => {
      assert.throws(
        () => count({ ticketType: "馬連", betStyle: "単点", isMulti: false, legs: [[1], []] }),
        /空の列/,
      );
    });

    it("馬単・3連単以外のマルチは落とす", () => {
      assert.throws(
        () =>
          count({
            ticketType: "馬連",
            betStyle: "単点",
            isMulti: true,
            legs: [[1], [2]],
          }),
        /マルチは指定できません/,
      );
    });

    it("100円単位でない金額は落とす", () => {
      assert.throws(
        () =>
          expandBet({
            ticketType: "単勝",
            betStyle: "単点",
            isMulti: false,
            legs: [[1]],
            unitAmount: 150,
          }),
        /100円単位/,
      );
    });
  });
});

describe("isHit", () => {
  describe("基本", () => {
    it("単勝は1着だけ", () => {
      assert.equal(isHit("単勝", [1], plain), true);
      assert.equal(isHit("単勝", [2], plain), false);
    });

    it("馬単は順序を見る", () => {
      assert.equal(isHit("馬単", [1, 2], plain), true);
      assert.equal(isHit("馬単", [2, 1], plain), false);
    });

    it("馬連は順序を見ない", () => {
      assert.equal(isHit("馬連", [1, 2], plain), true);
      assert.equal(isHit("馬連", [2, 1], plain), true);
    });

    it("3連単は3着まで順番どおり", () => {
      assert.equal(isHit("3連単", [1, 2, 3], plain), true);
      assert.equal(isHit("3連単", [1, 3, 2], plain), false);
    });

    it("3連複は顔ぶれだけ見る", () => {
      assert.equal(isHit("3連複", [3, 1, 2], plain), true);
      assert.equal(isHit("3連複", [1, 2, 4], plain), false);
    });
  });

  describe("同着", () => {
    // 1着が2頭同着。着順は 1, 1, 3, 4 ... と飛ぶ
    const deadHeatFirst = [entry(1, 1, 1), entry(2, 2, 1), ...[3, 4, 5, 6, 7, 8].map((n) => entry(n, n, n))];

    // 3着が2頭同着。着順は 1, 2, 3, 3 ...
    const deadHeatThird = [
      entry(1, 1, 1),
      entry(2, 2, 2),
      entry(3, 3, 3),
      entry(4, 4, 3),
      ...[5, 6, 7, 8].map((n) => entry(n, n, n)),
    ];

    it("1着同着なら3連複「1着-1着-3着」は的中", () => {
      // JRA が公表している例
      assert.equal(isHit("3連複", [1, 2, 3], deadHeatFirst), true);
    });

    it("3着同着なら3連複「1着-3着-3着」は不的中", () => {
      // JRA が公表している例
      assert.equal(isHit("3連複", [1, 3, 4], deadHeatThird), false);
    });

    it("3着同着でも「1着-2着-3着」は的中", () => {
      assert.equal(isHit("3連複", [1, 2, 3], deadHeatThird), true);
    });

    it("1着同着なら馬単は両方向とも的中", () => {
      assert.equal(isHit("馬単", [1, 2], deadHeatFirst), true);
      assert.equal(isHit("馬単", [2, 1], deadHeatFirst), true);
    });

    it("1着同着なら3連単の該当2通りが的中", () => {
      assert.equal(isHit("3連単", [1, 2, 3], deadHeatFirst), true);
      assert.equal(isHit("3連単", [2, 1, 3], deadHeatFirst), true);
      assert.equal(isHit("3連単", [1, 3, 2], deadHeatFirst), false);
    });
  });

  describe("複勝とワイド", () => {
    it("8頭以上なら複勝は3着まで", () => {
      assert.equal(isHit("複勝", [3], plain), true);
      assert.equal(isHit("複勝", [4], plain), false);
    });

    it("7頭以下なら複勝は2着まで", () => {
      const seven = plain.slice(0, 7);
      assert.equal(isHit("複勝", [2], seven), true);
      assert.equal(isHit("複勝", [3], seven), false);
    });

    it("ワイドは常に3着まで", () => {
      assert.equal(isHit("ワイド", [1, 3], plain), true);
      assert.equal(isHit("ワイド", [2, 3], plain), true);
      assert.equal(isHit("ワイド", [1, 4], plain), false);
    });
  });

  describe("枠連", () => {
    it("1着と2着の枠の組が当たり", () => {
      assert.equal(isHit("枠連", [1, 2], plain), true);
      assert.equal(isHit("枠連", [2, 1], plain), true);
      assert.equal(isHit("枠連", [1, 3], plain), false);
    });

    it("同じ枠から1着2着が出たらゾロ目が当たり", () => {
      const sameBracket = [
        entry(1, 3, 1),
        entry(2, 3, 2),
        entry(3, 1, 3),
        ...[4, 5, 6, 7, 8].map((n) => entry(n, n, n)),
      ];
      assert.equal(isHit("枠連", [3, 3], sameBracket), true);
      assert.equal(isHit("枠連", [1, 3], sameBracket), false);
    });
  });

  describe("WIN5", () => {
    it("5レースすべての1着", () => {
      const across = [entry(1, 1, 1), entry(2, 1, 1), entry(3, 1, 1), entry(4, 1, 1), entry(5, 1, 1)];
      assert.equal(isHit("WIN5", [1, 2, 3, 4, 5], across), true);

      const oneMissed = [...across.slice(0, 4), entry(5, 1, 2)];
      assert.equal(isHit("WIN5", [1, 2, 3, 4, 5], oneMissed), false);
    });
  });

  describe("走らなかった馬", () => {
    const withScratch = [
      entry(1, 1, 1),
      entry(2, 2, 2),
      entry(3, 3, 3),
      entry(4, 4, null, "中止"),
      entry(5, 5, 4),
      entry(6, 6, 5),
      entry(7, 7, 6),
      entry(8, 8, null, "取消"),
    ];

    it("着順の無い馬を含む買い目は的中しない", () => {
      assert.equal(isHit("馬連", [1, 4], withScratch), false);
      assert.equal(isHit("馬連", [1, 8], withScratch), false);
    });

    it("結果に無い出走を渡したら落とす", () => {
      assert.throws(() => isHit("単勝", [99], withScratch), /含まれていません/);
    });
  });
});

describe("countRunners", () => {
  it("取消・除外だけを除く。中止は数える", () => {
    const results = [
      entry(1, 1, 1),
      entry(2, 2, null, "中止"),
      entry(3, 3, null, "取消"),
      entry(4, 4, null, "除外"),
      entry(5, 5, null, "失格"),
    ];
    // 出走・中止・失格の3頭
    assert.equal(countRunners(results), 3);
  });
});

describe("placeLimit", () => {
  it("8頭以上なら3着、5〜7頭なら2着", () => {
    assert.equal(placeLimit(plain), 3);
    assert.equal(placeLimit(plain.slice(0, 8)), 3);
    assert.equal(placeLimit(plain.slice(0, 7)), 2);
    assert.equal(placeLimit(plain.slice(0, 5)), 2);
  });

  it("4頭以下は複勝が発売されないので落とす", () => {
    assert.throws(() => placeLimit(plain.slice(0, 4)), /発売されません/);
  });

  it("中止した馬を数え落とさない", () => {
    // 着順が入っているのは7頭だが、中止を含めると8頭なので3着まで
    const results = [...plain.slice(0, 7), entry(8, 8, null, "中止")];
    assert.equal(placeLimit(results), 3);
  });
});

describe("recoveryRate", () => {
  it("払戻と返還の合計を購入金額で割る", () => {
    assert.equal(recoveryRate({ payout: 1500, refund: 0, totalAmount: 1000 }), 1.5);
    assert.equal(recoveryRate({ payout: 0, refund: 500, totalAmount: 1000 }), 0.5);
  });

  it("レース前で払戻が未入力なら0として扱う", () => {
    assert.equal(recoveryRate({ payout: null, refund: null, totalAmount: 1000 }), 0);
  });
});
