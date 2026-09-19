import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allocateEvenPayout,
  maxProfitableCount,
  parseAllocateArgs,
  payoutPerUnit,
} from "./allocation.ts";

describe("payoutPerUnit", () => {
  it("100円あたりの払戻はオッズ×100円", () => {
    assert.equal(payoutPerUnit(7.1), 710);
    assert.equal(payoutPerUnit(1.0), 100);
    assert.equal(payoutPerUnit(123.4), 12340);
  });

  it("浮動小数点の誤差があっても0.1倍刻みに丸める", () => {
    // 0.1 + 0.2 は 0.30000000000000004 になる
    assert.equal(payoutPerUnit(3 + 0.1 + 0.2), 330);
  });

  it("1.0倍未満と、0.1倍刻みでないオッズは受け付けない", () => {
    assert.throws(() => payoutPerUnit(0.9), /1\.0倍以上/);
    assert.throws(() => payoutPerUnit(Number.NaN), /1\.0倍以上/);
    assert.throws(() => payoutPerUnit(2.35), /0\.1倍刻み/);
  });
});

describe("allocateEvenPayout", () => {
  it("配当の低い組み合わせに厚く、高い組み合わせに薄く置く", () => {
    // 2.0倍と4.0倍に1,200円。最も小さい払戻が最大になるのは 800円・400円 で、どちらも1,600円
    const result = allocateEvenPayout([2.0, 4.0], 1200);
    assert.deepEqual(result.amounts, [800, 400]);
    assert.deepEqual(result.payouts, [1600, 1600]);
    assert.equal(result.minPayout, 1600);
    assert.equal(result.totalAmount, 1200);
  });

  it("予算を余らせない", () => {
    for (const odds of [[3.4], [2.1, 5.8, 13.2], [4.4, 6.0, 9.9, 15.5, 31.0], [1.3, 1.3, 1.3]]) {
      const result = allocateEvenPayout(odds, 2000);
      assert.equal(
        result.amounts.reduce((sum, amount) => sum + amount, 0),
        2000,
        odds.join(","),
      );
      assert.ok(result.amounts.every((amount) => amount >= 100 && amount % 100 === 0));
    }
  });

  it("払戻の差は、100円足したときの払戻の増え方より大きくならない", () => {
    // 最も小さい組み合わせへ100円ずつ足していくので、差は1口ぶん以内に収まる
    const odds = [3.2, 7.5, 12.8, 25.1];
    const result = allocateEvenPayout(odds, 2000);
    const spread = Math.max(...result.payouts) - result.minPayout;
    assert.ok(spread <= Math.max(...odds.map(payoutPerUnit)), `差 ${spread}`);
  });

  it("最も小さい払戻は、すべての割り方の中で最大になる", () => {
    // 小さい予算なら、100円単位の割り方を全部数え上げて比べられる
    const cases: Array<[number[], number]> = [
      [[2.3, 5.1, 9.8], 1000],
      [[1.4, 3.3, 3.3, 12.0], 1200],
      [[6.0, 2.2], 900],
      [[15.5, 31.0, 4.4, 7.7, 2.9], 1300],
    ];
    for (const [odds, budget] of cases) {
      const best = bestMinPayout(odds, budget);
      assert.equal(allocateEvenPayout(odds, budget).minPayout, best, odds.join(","));
    }
  });

  it("払戻が並んだときは先に渡された組み合わせへ足す", () => {
    // 同じオッズが2つなら、100円ずつ交互に置かれ、余りの1口は先頭へ行く
    assert.deepEqual(allocateEvenPayout([5.0, 5.0], 500).amounts, [300, 200]);
  });

  it("予算が100円単位でない、組み合わせが無い、100円ずつも置けないときは止める", () => {
    assert.throws(() => allocateEvenPayout([2.0], 2050), /100円単位/);
    assert.throws(() => allocateEvenPayout([2.0], 0), /100円単位/);
    assert.throws(() => allocateEvenPayout([], 2000), /1つもありません/);
    assert.throws(
      () => allocateEvenPayout(Array.from({ length: 21 }, () => 50.0), 2000),
      /100円ずつも置けません/,
    );
  });
});

describe("maxProfitableCount", () => {
  it("足して払戻が予算を上回らなくなったら、その手前で止める", () => {
    // 2.0倍・4.0倍・4.0倍の3点は、どう割っても払戻が2,000円ちょうどまでしか届かない
    const result = maxProfitableCount([2.0, 4.0, 4.0, 10.0], 2000);
    assert.ok(result);
    assert.equal(result.count, 2);
    assert.ok(result.allocation.minPayout > 2000);
    assert.equal(result.allocation.amounts.length, 2);
  });

  it("上回らなくなったら、その候補を飛ばして後ろを試すことはしない", () => {
    // 3点目の1.2倍で上回らなくなる。3点目を飛ばして4点目の100.0倍を足せば上回るが、そこへは進まない
    assert.equal(maxProfitableCount([2.0, 3.0, 100.0], 2000)?.count, 3);
    const result = maxProfitableCount([2.0, 3.0, 1.2, 100.0], 2000);
    assert.ok(result);
    assert.equal(result.count, 2);
  });

  it("候補がすべて上回るなら、すべて買う", () => {
    const result = maxProfitableCount([6.0, 8.0, 12.0], 2000);
    assert.ok(result);
    assert.equal(result.count, 3);
    assert.ok(result.allocation.minPayout > 2000);
  });

  it("先頭の1点だけでも予算を上回らなければ null", () => {
    assert.equal(maxProfitableCount([1.0, 5.0], 2000), null);
  });

  it("予算を上回るかは、ちょうど同じ額をプラスとしない", () => {
    // 2.0倍の1点に2,000円なら払戻は4,000円。2.0倍を2点なら2,000円ちょうどで、プラスではない
    const result = maxProfitableCount([2.0, 2.0], 2000);
    assert.ok(result);
    assert.equal(result.count, 1);
  });

  it("候補が無ければ null", () => {
    assert.equal(maxProfitableCount([], 2000), null);
  });

  it("予算が100円単位でなければ、候補の判定より先に止める", () => {
    assert.throws(() => maxProfitableCount([5.0], 50), /100円単位/);
    assert.throws(() => maxProfitableCount([], 2050), /100円単位/);
  });
});

describe("parseAllocateArgs", () => {
  it("カンマ区切りのオッズを読み、予算を省けば2,000円にする", () => {
    assert.deepEqual(parseAllocateArgs(["--", "--odds", "12.3, 18.4,25"]), {
      odds: [12.3, 18.4, 25],
      budget: 2000,
    });
  });

  it("予算を渡せばそれを使う", () => {
    assert.deepEqual(parseAllocateArgs(["--odds", "3.2", "--budget", "1000"]), {
      odds: [3.2],
      budget: 1000,
    });
  });

  it("オッズが無い、数字でない、知らない引数があるときは止める", () => {
    assert.throws(() => parseAllocateArgs([]), /--odds がありません/);
    assert.throws(() => parseAllocateArgs(["--odds"]), /--odds の値がありません/);
    assert.throws(() => parseAllocateArgs(["--odds", "3.2,abc"]), /数字ではありません/);
    assert.throws(() => parseAllocateArgs(["--odds", "3.2", "--budget", "1.5"]), /整数ではありません/);
    assert.throws(() => parseAllocateArgs(["--odds", "3.2", "--race", "1"]), /知らない引数/);
  });
});

/** 100円単位の割り方をすべて数え上げ、最も小さい払戻の最大値を返す。テストの突き合わせ用。 */
function bestMinPayout(odds: number[], budget: number): number {
  const units = budget / 100;
  let best = 0;
  const walk = (index: number, left: number, current: number[]): void => {
    if (index === odds.length - 1) {
      if (left < 1) return;
      const all = [...current, left];
      best = Math.max(best, Math.min(...all.map((count, i) => count * payoutPerUnit(odds[i]))));
      return;
    }
    for (let count = 1; count <= left - (odds.length - 1 - index); count++) {
      walk(index + 1, left - count, [...current, count]);
    }
  };
  walk(0, units, []);
  return best;
}
