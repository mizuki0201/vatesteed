import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createSessionValue,
  readSessionValue,
  safeEqual,
  SESSION_MAX_AGE_SECONDS,
} from "./session.ts";

const SECRET = "テスト用のシークレット";
const NOW = Date.UTC(2026, 7, 16, 0, 0, 0);

describe("createSessionValue / readSessionValue", () => {
  it("作った値をそのまま読むと、入れたレベルが返る", () => {
    const value = createSessionValue("owner", SECRET, NOW);

    assert.equal(readSessionValue(value, SECRET, NOW), "owner");
  });

  it("シークレットが違えば通さない", () => {
    const value = createSessionValue("owner", SECRET, NOW);

    assert.equal(readSessionValue(value, "別のシークレット", NOW), undefined);
  });

  it("中身を書き換えると署名が合わずに通らない", () => {
    const value = createSessionValue("member", SECRET, NOW);
    const [, signature] = value.split(".");
    const forged = `${Buffer.from(JSON.stringify({ level: "owner", exp: 99999999999 }), "utf8").toString("base64url")}.${signature}`;

    assert.equal(readSessionValue(forged, SECRET, NOW), undefined);
  });

  it("期限を過ぎていれば通さない", () => {
    const value = createSessionValue("friend", SECRET, NOW);
    const afterExpiry = NOW + (SESSION_MAX_AGE_SECONDS + 1) * 1000;

    assert.equal(readSessionValue(value, SECRET, afterExpiry), undefined);
  });

  it("期限の直前なら通る", () => {
    const value = createSessionValue("friend", SECRET, NOW);
    const justBefore = NOW + (SESSION_MAX_AGE_SECONDS - 1) * 1000;

    assert.equal(readSessionValue(value, SECRET, justBefore), "friend");
  });

  it("知らないレベルが入っていれば通さない", () => {
    const encoded = Buffer.from(
      JSON.stringify({ level: "admin", exp: Math.floor(NOW / 1000) + 100 }),
      "utf8",
    ).toString("base64url");
    const signed = createSessionValue("owner", SECRET, NOW);
    // 署名だけ正しくても、レベルが知らない値なら弾く
    assert.equal(readSessionValue(`${encoded}.${signed.split(".")[1]}`, SECRET, NOW), undefined);
  });

  it("空・壊れた形は通さない", () => {
    assert.equal(readSessionValue(undefined, SECRET, NOW), undefined);
    assert.equal(readSessionValue("", SECRET, NOW), undefined);
    assert.equal(readSessionValue("署名が無い", SECRET, NOW), undefined);
    assert.equal(readSessionValue(".署名だけ", SECRET, NOW), undefined);
  });
});

describe("safeEqual", () => {
  it("同じ文字列なら true", () => {
    assert.equal(safeEqual("あいことば", "あいことば"), true);
  });

  it("長さが違っても例外にならず false", () => {
    assert.equal(safeEqual("みじかい", "とてもながいあいことば"), false);
  });

  it("長さが同じで中身が違えば false", () => {
    assert.equal(safeEqual("abcd", "abce"), false);
  });
});
