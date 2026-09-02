import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HORSE_PAGE_SIZE, horsePage, pageNumber } from "./pagination.ts";

describe("pageNumber", () => {
  it("1以上の整数はそのまま使う", () => {
    assert.equal(pageNumber("1"), 1);
    assert.equal(pageNumber("2"), 2);
    assert.equal(pageNumber("999"), 999);
  });

  it("未指定は1ページ目にする", () => {
    assert.equal(pageNumber(undefined), 1);
  });

  it("0以下は1ページ目にする", () => {
    assert.equal(pageNumber("0"), 1);
    assert.equal(pageNumber("-1"), 1);
  });

  it("整数でない値は1ページ目にする", () => {
    assert.equal(pageNumber(""), 1);
    assert.equal(pageNumber("1.5"), 1);
    assert.equal(pageNumber("2ページ"), 1);
    assert.equal(pageNumber("abc"), 1);
    assert.equal(pageNumber(" 2"), 1);
  });

  it("整数として扱えない大きさは1ページ目にする", () => {
    assert.equal(pageNumber("9".repeat(30)), 1);
  });
});

describe("horsePage", () => {
  it("1ページ目は先頭から出す", () => {
    assert.deepEqual(horsePage({ total: 223, page: 1 }), {
      page: 1,
      pageCount: 5,
      offset: 0,
    });
  });

  it("2ページ目は1ページぶん飛ばす", () => {
    assert.deepEqual(horsePage({ total: 223, page: 2 }), {
      page: 2,
      pageCount: 5,
      offset: 50,
    });
  });

  it("端数のあるページ数は切り上げる", () => {
    assert.equal(horsePage({ total: 223, page: 1 }).pageCount, 5);
    assert.equal(horsePage({ total: 200, page: 1 }).pageCount, 4);
    assert.equal(horsePage({ total: 201, page: 1 }).pageCount, 5);
  });

  it("総ページ数を超えるページ番号は最終ページにする", () => {
    assert.deepEqual(horsePage({ total: 223, page: 9 }), {
      page: 5,
      pageCount: 5,
      offset: 200,
    });
  });

  it("1頭も無いときも1ページとして扱う", () => {
    assert.deepEqual(horsePage({ total: 0, page: 1 }), { page: 1, pageCount: 1, offset: 0 });
    assert.deepEqual(horsePage({ total: 0, page: 4 }), { page: 1, pageCount: 1, offset: 0 });
  });

  it("1ページに収まるときは1ページだけにする", () => {
    assert.deepEqual(horsePage({ total: 30, page: 1 }), { page: 1, pageCount: 1, offset: 0 });
  });

  it("1ページの頭数を変えられる", () => {
    assert.deepEqual(horsePage({ total: 10, page: 3, perPage: 3 }), {
      page: 3,
      pageCount: 4,
      offset: 6,
    });
  });
});

describe("HORSE_PAGE_SIZE", () => {
  it("1ページ50頭にする", () => {
    assert.equal(HORSE_PAGE_SIZE, 50);
  });
});
