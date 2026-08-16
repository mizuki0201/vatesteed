import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasAnyPassword, PASSWORD_ENV, resolvePasswordLevel } from "./password.ts";

const ENV = {
  [PASSWORD_ENV.owner]: "おーなーのあいことば",
  [PASSWORD_ENV.friend]: "ともだちのあいことば",
} as const;

describe("resolvePasswordLevel", () => {
  it("自分のパスワードなら owner", () => {
    assert.equal(resolvePasswordLevel("おーなーのあいことば", ENV), "owner");
  });

  it("友達のパスワードなら friend", () => {
    assert.equal(resolvePasswordLevel("ともだちのあいことば", ENV), "friend");
  });

  it("合わなければ undefined", () => {
    assert.equal(resolvePasswordLevel("ちがうあいことば", ENV), undefined);
  });

  it("設定していないレベルでは入れない", () => {
    assert.equal(resolvePasswordLevel("", { [PASSWORD_ENV.member]: undefined }), undefined);
    assert.equal(resolvePasswordLevel("なんでもいい", {}), undefined);
  });

  it("空文字では入れない。環境変数が空でも同じ", () => {
    assert.equal(resolvePasswordLevel("", ENV), undefined);
    assert.equal(resolvePasswordLevel("", { [PASSWORD_ENV.owner]: "" }), undefined);
  });

  it("同じ文字列が2つのレベルに入っていたら、強い方を返す", () => {
    const env = {
      [PASSWORD_ENV.owner]: "おなじ",
      [PASSWORD_ENV.friend]: "おなじ",
    };

    assert.equal(resolvePasswordLevel("おなじ", env), "owner");
  });

  it("前後の空白まで含めて一致を見る", () => {
    assert.equal(resolvePasswordLevel(" おーなーのあいことば", ENV), undefined);
  });
});

describe("hasAnyPassword", () => {
  it("1つでも設定されていれば true", () => {
    assert.equal(hasAnyPassword(ENV), true);
  });

  it("1つも設定されていなければ false", () => {
    assert.equal(hasAnyPassword({}), false);
    assert.equal(hasAnyPassword({ [PASSWORD_ENV.owner]: "" }), false);
  });
});
