import assert from "node:assert/strict";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { loadRunRecord, saveRunRecord } from "./run-record.ts";
import type { ClaudeCommand } from "./claude-opus.ts";
import {
  type ClaudeProcessInput,
  type ClaudeProcessOutcome,
  type ClaudeProcessRunner,
  runClaudeOpus,
} from "./run.ts";

function successStdout(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
    result: "AUTH_OK",
    terminal_reason: "completed",
    modelUsage: { "claude-opus-5": { totalInputTokens: 10 } },
    subagent_stats: { spawned: 0 },
    session_id: "11111111-2222-3333-4444-555555555555",
    ...overrides,
  });
}

/** Claude を呼ばずに、渡された引数と環境変数を覚えておく差し込み。 */
function stubRunner(outcome: Partial<ClaudeProcessOutcome>): {
  run: ClaudeProcessRunner;
  calls: ClaudeProcessInput[];
} {
  const calls: ClaudeProcessInput[] = [];
  const run: ClaudeProcessRunner = async (input) => {
    calls.push(input);
    const result = { exitCode: 0, stdout: "", stderr: "", ...outcome };
    await input.onStdoutChunk?.(result.stdout);
    return result;
  };

  return { run, calls };
}

async function makeDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vatesteed-run-"));
}

function newCommand(prompt: string): ClaudeCommand {
  return {
    kind: "new",
    prompt,
    taskPath: "docs/tasks/example.md",
    mode: "development",
    executorRole: "dev-implementer",
  };
}

function resumeCommand(runId: string, prompt: string): ClaudeCommand {
  return {
    kind: "resume",
    runId,
    prompt,
    taskPath: "docs/tasks/example.md",
    mode: "development",
    executorRole: "dev-implementer",
  };
}

test("新規実行は完了した実行記録を残す", async () => {
  const runsDir = await makeDir();
  const { run, calls } = stubRunner({ stdout: successStdout() });

  const output = await runClaudeOpus({
    command: newCommand("AUTH_OK だけを返す"),
    runsDir,
    runProcess: run,
    env: {},
  });

  assert.equal(output.ok, true);
  assert.equal(output.result, "AUTH_OK");
  assert.equal(output.run.state, "completed");
  assert.equal(output.run.sessionId, "11111111-2222-3333-4444-555555555555");
  assert.equal(output.run.model, "claude-opus-5");
  assert.equal(calls.length, 1);
  assert.deepEqual(await loadRunRecord(runsDir, output.run.runId), output.run);
});

test("子エージェントを引数で禁止し、同時実行数を2に固定する", async () => {
  const runsDir = await makeDir();
  const { run, calls } = stubRunner({ stdout: successStdout() });

  await runClaudeOpus({
    command: newCommand("AUTH_OK だけを返す"),
    runsDir,
    runProcess: run,
    env: { CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY: "16", PATH: "/usr/bin" },
  });

  assert.ok(calls[0].args.includes("--disallowedTools"));
  assert.ok(calls[0].args.includes("Agent"));
  assert.equal(calls[0].env.CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY, "2");
  assert.equal(calls[0].env.PATH, "/usr/bin");
});

test("子エージェントが起動した実行は未完了として残す", async () => {
  const runsDir = await makeDir();
  const { run } = stubRunner({ stdout: successStdout({ subagent_stats: { spawned: 2 } }) });

  const output = await runClaudeOpus({
    command: newCommand("18頭ぶん手分けして読む"),
    runsDir,
    runProcess: run,
    env: {},
  });

  assert.equal(output.ok, false);
  assert.equal(output.run.state, "incomplete");
  assert.equal(output.run.subagentsSpawned, 2);
  assert.match(output.error ?? "", /子エージェントが 2 個/);
});

test("終了コードが0でも検証に落ちれば未完了として残す", async () => {
  const runsDir = await makeDir();
  const { run } = stubRunner({ exitCode: 0, stdout: "" });

  const output = await runClaudeOpus({
    command: newCommand("AUTH_OK だけを返す"),
    runsDir,
    runProcess: run,
    env: {},
  });

  assert.equal(output.ok, false);
  assert.equal(output.result, null);
  assert.match(output.error ?? "", /標準出力が空/);
  assert.equal((await loadRunRecord(runsDir, output.run.runId)).state, "incomplete");
});

test("検証を通っても終了コードが0でなければ未完了として残す", async () => {
  const runsDir = await makeDir();
  const { run } = stubRunner({ exitCode: 2, stdout: successStdout() });

  const output = await runClaudeOpus({
    command: newCommand("AUTH_OK だけを返す"),
    runsDir,
    runProcess: run,
    env: {},
  });

  assert.equal(output.ok, false);
  assert.match(output.error ?? "", /終了コードが 0 ではなかった/);
});

test("子プロセスが起動できなくても実行記録を残す", async () => {
  const runsDir = await makeDir();
  const runProcess: ClaudeProcessRunner = async () => {
    throw new Error("spawn claude ENOENT");
  };

  const output = await runClaudeOpus({
    command: newCommand("AUTH_OK だけを返す"),
    runsDir,
    runProcess,
    env: {},
  });

  assert.equal(output.ok, false);
  assert.equal((await loadRunRecord(runsDir, output.run.runId)).state, "incomplete");
});

test("標準エラーの生ログは実行記録に残さない", async () => {
  const runsDir = await makeDir();
  const { run } = stubRunner({
    exitCode: 1,
    stdout: "",
    stderr: "OAuth token rejected\nsecret-token-value\n",
  });

  const output = await runClaudeOpus({
    command: newCommand("AUTH_OK だけを返す"),
    runsDir,
    runProcess: run,
    env: {},
  });

  const saved = JSON.stringify(await loadRunRecord(runsDir, output.run.runId));
  assert.equal(saved.includes("secret-token-value"), false);
  assert.equal(JSON.stringify(output).includes("secret-token-value"), false);
});

test("未完了の実行記録から同じセッションを再開する", async () => {
  const runsDir = await makeDir();
  const { run } = stubRunner({ stdout: successStdout() });

  const first = await runClaudeOpus({
    command: newCommand("続きの要る依頼"),
    runsDir,
    runProcess: (async () => ({
      exitCode: 1,
      stdout: JSON.stringify({
        type: "result",
        subtype: "error_max_turns",
        is_error: true,
        terminal_reason: "max_turns",
        modelUsage: { "claude-opus-5": {} },
        session_id: "11111111-2222-3333-4444-555555555555",
      }),
      stderr: "",
    })) as ClaudeProcessRunner,
    env: {},
  });

  assert.equal(first.ok, false);

  const resumed = await runClaudeOpus({
    command: resumeCommand(first.run.runId, "続きをやる"),
    runsDir,
    runProcess: run,
    env: {},
  });

  assert.equal(resumed.ok, true);
  assert.equal(resumed.run.runId, first.run.runId);
  assert.equal(resumed.run.startedAt, first.run.startedAt);
  assert.equal(resumed.run.state, "completed");
});

test("再開は保存されたセッションIDを渡し、新規実行に切り替えない", async () => {
  const runsDir = await makeDir();
  const { run, calls } = stubRunner({ stdout: successStdout() });
  await saveRunRecord(runsDir, {
    runId: "20260828-093012-a1b2c3d4",
    sessionId: "aaaa-bbbb",
    taskPath: "docs/tasks/example.md",
    mode: "development",
    executorRole: "dev-implementer",
    state: "incomplete",
    exitCode: 1,
    terminalReason: "max_turns",
    model: "claude-opus-5",
    subagentsSpawned: 0,
    error: "途中で終わった。",
    result: null,
    startedAt: "2026-08-28T00:30:12.000Z",
    updatedAt: "2026-08-28T00:35:00.000Z",
  });

  await runClaudeOpus({
    command: resumeCommand("20260828-093012-a1b2c3d4", "続きをやる"),
    runsDir,
    runProcess: run,
    env: {},
  });

  assert.deepEqual(calls[0].args.slice(calls[0].args.indexOf("--resume")), [
    "--resume",
    "aaaa-bbbb",
    "続きをやる",
  ]);
});

test("完了済みの実行記録は再開せず、新規実行にも切り替えない", async () => {
  const runsDir = await makeDir();
  const { run, calls } = stubRunner({ stdout: successStdout() });
  await saveRunRecord(runsDir, {
    runId: "20260828-093012-a1b2c3d4",
    sessionId: "aaaa-bbbb",
    taskPath: "docs/tasks/example.md",
    mode: "development",
    executorRole: "dev-implementer",
    state: "completed",
    exitCode: 0,
    terminalReason: "completed",
    model: "claude-opus-5",
    subagentsSpawned: 0,
    error: null,
    result: "できた",
    startedAt: "2026-08-28T00:30:12.000Z",
    updatedAt: "2026-08-28T00:35:00.000Z",
  });

  await assert.rejects(
    () =>
      runClaudeOpus({
        command: resumeCommand("20260828-093012-a1b2c3d4", "続きをやる"),
        runsDir,
        runProcess: run,
        env: {},
      }),
    /完了済みです/,
  );
  assert.equal(calls.length, 0);
});

test("Codexの確認で未完了なら正常終了した同じセッションを明示的に再開する", async () => {
  const runsDir = await makeDir();
  const { run, calls } = stubRunner({ stdout: successStdout() });
  await saveRunRecord(runsDir, {
    runId: "20260828-093012-a1b2c3d4",
    sessionId: "aaaa-bbbb",
    taskPath: "docs/tasks/example.md",
    mode: "development",
    executorRole: "dev-implementer",
    state: "completed",
    exitCode: 0,
    terminalReason: "completed",
    model: "claude-opus-5",
    subagentsSpawned: 0,
    error: null,
    result: "実装した",
    startedAt: "2026-08-28T00:30:12.000Z",
    updatedAt: "2026-08-28T00:35:00.000Z",
  });

  const output = await runClaudeOpus({
    command: resumeCommand("20260828-093012-a1b2c3d4", "不足を直す"),
    runsDir,
    runProcess: run,
    env: {},
    reopenCompleted: true,
  });

  assert.equal(output.ok, true);
  assert.equal(output.run.runId, "20260828-093012-a1b2c3d4");
  assert.ok(calls[0].args.includes("aaaa-bbbb"));
});

test("見つからない実行記録は新規実行にならない", async () => {
  const runsDir = await makeDir();
  const { run, calls } = stubRunner({ stdout: successStdout() });

  await assert.rejects(
    () =>
      runClaudeOpus({
        command: resumeCommand("20260828-093012-ffffffff", "続きをやる"),
        runsDir,
        runProcess: run,
        env: {},
      }),
    /見つかりません/,
  );
  assert.equal(calls.length, 0);
});

test("同じタスクMarkdownを新しいClaude Codeセッションでやり直さない", async () => {
  const runsDir = await makeDir();
  const first = await runClaudeOpus({
    command: newCommand("実装する"),
    runsDir,
    runProcess: stubRunner({ stdout: successStdout() }).run,
    env: {},
  });
  const { run, calls } = stubRunner({ stdout: successStdout() });

  await assert.rejects(
    () => runClaudeOpus({ command: newCommand("最初からやり直す"), runsDir, runProcess: run, env: {} }),
    new RegExp(first.run.runId),
  );
  assert.equal(calls.length, 0);
});

test("本人が最初からやり直すよう明示した場合だけ新規実行を許す", async () => {
  const runsDir = await makeDir();
  await runClaudeOpus({
    command: newCommand("実装する"),
    runsDir,
    runProcess: stubRunner({ stdout: successStdout() }).run,
    env: {},
  });

  const output = await runClaudeOpus({
    command: newCommand("最初からやり直す"),
    runsDir,
    runProcess: stubRunner({ stdout: successStdout({ session_id: "new-session" }) }).run,
    env: {},
    allowExistingTaskRun: true,
  });
  assert.equal(output.ok, true);
  assert.equal(output.run.sessionId, "new-session");
});

test("Claudeの終了前に実行記録とセッションIDを保存する", async () => {
  const runsDir = await makeDir();
  let runningStateChecked = false;
  const init = JSON.stringify({ type: "system", subtype: "init", session_id: "early-session" });
  const result = successStdout({ session_id: "early-session" });
  const runProcess: ClaudeProcessRunner = async (input) => {
    await input.onStdoutChunk?.(`${init}\n`);
    const [file] = await readdir(runsDir);
    const running = await loadRunRecord(runsDir, file.replace(/\.json$/, ""));
    assert.equal(running.state, "running");
    assert.equal(running.sessionId, "early-session");
    runningStateChecked = true;
    await input.onStdoutChunk?.(`${result}\n`);
    return { exitCode: 0, stdout: `${init}\n${result}\n`, stderr: "" };
  };

  const output = await runClaudeOpus({
    command: newCommand("実装する"),
    runsDir,
    runProcess,
    env: {},
  });

  assert.equal(runningStateChecked, true);
  assert.equal(output.run.sessionId, "early-session");
  assert.equal(output.run.taskPath, "docs/tasks/example.md");
});

test("再開時に別のタスクMarkdownへ差し替えない", async () => {
  const runsDir = await makeDir();
  await saveRunRecord(runsDir, {
    runId: "20260828-093012-a1b2c3d4",
    sessionId: "aaaa-bbbb",
    taskPath: "docs/tasks/original.md",
    mode: "development",
    executorRole: "dev-implementer",
    state: "incomplete",
    exitCode: 1,
    terminalReason: "api_error",
    model: "claude-opus-5",
    subagentsSpawned: 0,
    error: "中断した。",
    result: null,
    startedAt: "2026-08-28T00:30:12.000Z",
    updatedAt: "2026-08-28T00:35:00.000Z",
  });

  await assert.rejects(
    () => runClaudeOpus({
      command: resumeCommand("20260828-093012-a1b2c3d4", "続きをやる"),
      runsDir,
      runProcess: stubRunner({ stdout: successStdout() }).run,
      env: {},
    }),
    /taskPath.*一致しません/,
  );
});
