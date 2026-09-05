import assert from "node:assert/strict";
import { test } from "node:test";
import { AGENT_MODE_ENV, agentModeEnv, isRacingAgentMode } from "./agent-mode.ts";

test("競馬モードのときだけ実行モードの環境変数に値が入る", () => {
  assert.deepEqual(agentModeEnv("racing"), { [AGENT_MODE_ENV]: "racing" });
});

test("開発モードでは値を入れず、呼び出し元に残っていた値を消す", () => {
  // 値が undefined の項目は子プロセスへ渡らない。前の実行の値を引き継がせないための形。
  assert.deepEqual(agentModeEnv("development"), { [AGENT_MODE_ENV]: undefined });
  assert.deepEqual(agentModeEnv(null), { [AGENT_MODE_ENV]: undefined });

  const env = { ...{ [AGENT_MODE_ENV]: "racing" }, ...agentModeEnv("development") };
  assert.equal(isRacingAgentMode(env), false);
});

test("環境変数が競馬モードの値のときだけ競馬モードと判定する", () => {
  assert.equal(isRacingAgentMode({ [AGENT_MODE_ENV]: "racing" }), true);
  assert.equal(isRacingAgentMode({ [AGENT_MODE_ENV]: "development" }), false);
  assert.equal(isRacingAgentMode({ [AGENT_MODE_ENV]: "" }), false);
  assert.equal(isRacingAgentMode({}), false);
});
