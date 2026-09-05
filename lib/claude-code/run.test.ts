import assert from "node:assert/strict";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { AGENT_MODE_ENV } from "../agent-mode/index.ts";
import { type ClaudeRunRecord, loadRunRecord, saveRunRecord } from "./run-record.ts";
import { acquireTaskLock, readTaskLock, taskLockPath, taskLocksDir } from "./task-lock.ts";
import type { ClaudeCommand } from "./claude-opus.ts";
import type { ClaudeProgress } from "./activity.ts";
import type { ClaudeSignalSource } from "./signals.ts";
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

/** 実行記録を先に置いておくときの雛形。既定は再開できる未完了の記録。 */
function storedRecord(overrides: Partial<ClaudeRunRecord> = {}): ClaudeRunRecord {
  return {
    runId: "20260828-093012-a1b2c3d4",
    sessionId: "11111111-2222-3333-4444-555555555555",
    taskPath: "docs/tasks/example.md",
    mode: "development",
    executorRole: "dev-implementer",
    state: "incomplete",
    exitCode: 1,
    terminalReason: "max_turns",
    model: "claude-opus-5",
    subagentsSpawned: 0,
    error: "途中で終わった。",
    failureKind: "other",
    result: null,
    completedResult: null,
    completedAt: null,
    lastActivityAt: null,
    lastActivityKind: null,
    lastActivityTool: null,
    eventCount: 0,
    startedAt: "2026-08-28T00:30:12.000Z",
    updatedAt: "2026-08-28T00:35:00.000Z",
    ...overrides,
  };
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

test("競馬のタスクの子プロセスにだけ実行モードを渡す", async () => {
  const runsDir = await makeDir();
  const racing = stubRunner({ stdout: successStdout() });
  const development = stubRunner({ stdout: successStdout() });

  await runClaudeOpus({
    command: {
      kind: "new",
      prompt: "札幌記念を予想する",
      taskPath: "docs/tasks/sapporo-kinen.md",
      mode: "racing",
      executorRole: "orchestrator",
    },
    runsDir,
    runProcess: racing.run,
    env: {},
  });
  await runClaudeOpus({
    command: newCommand("実装する"),
    runsDir: await makeDir(),
    runProcess: development.run,
    // 前の実行の値が残っていても、開発モードでは渡さない
    env: { [AGENT_MODE_ENV]: "racing" },
  });

  assert.equal(racing.calls[0].env[AGENT_MODE_ENV], "racing");
  assert.equal(development.calls[0].env[AGENT_MODE_ENV], undefined);
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
  assert.equal(output.result, null);
  assert.equal(output.run.completedResult, "AUTH_OK");
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
  await saveRunRecord(runsDir, storedRecord({ sessionId: "aaaa-bbbb" }));

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
  await saveRunRecord(
    runsDir,
    storedRecord({
      sessionId: "aaaa-bbbb",
      state: "completed",
      exitCode: 0,
      terminalReason: "completed",
      error: null,
      result: "できた",
    }),
  );

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
  await saveRunRecord(
    runsDir,
    storedRecord({
      sessionId: "aaaa-bbbb",
      state: "completed",
      exitCode: 0,
      terminalReason: "completed",
      error: null,
      result: "実装した",
    }),
  );

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
  await saveRunRecord(
    runsDir,
    storedRecord({
      sessionId: "aaaa-bbbb",
      taskPath: "docs/tasks/original.md",
      terminalReason: "api_error",
      error: "中断した。",
    }),
  );

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

/** 実行中として残っている実行記録。前の入口が終わっていない状態を作る。 */
async function saveRunningRecord(runsDir: string): Promise<void> {
  await saveRunRecord(
    runsDir,
    storedRecord({
      runId: "20260901-101500-aaaaaaaa",
      sessionId: "aaaa-bbbb",
      state: "running",
      exitCode: null,
      terminalReason: null,
      model: null,
      subagentsSpawned: null,
      error: null,
      startedAt: "2026-09-01T01:15:00.000Z",
      updatedAt: "2026-09-01T01:15:00.000Z",
    }),
  );
}

test("実行中の実行記録があるタスクは新規実行できない", async () => {
  const runsDir = await makeDir();
  await saveRunningRecord(runsDir);
  const { run, calls } = stubRunner({ stdout: successStdout() });

  await assert.rejects(
    () => runClaudeOpus({ command: newCommand("実装する"), runsDir, runProcess: run, env: {} }),
    /実行中です/,
  );
  assert.equal(calls.length, 0);
});

test("実行中の実行記録があるタスクは再開できない", async () => {
  const runsDir = await makeDir();
  await saveRunningRecord(runsDir);
  const { run, calls } = stubRunner({ stdout: successStdout() });

  await assert.rejects(
    () =>
      runClaudeOpus({
        command: resumeCommand("20260901-101500-aaaaaaaa", "続きをやる"),
        runsDir,
        runProcess: run,
        env: {},
      }),
    /実行中です/,
  );
  assert.equal(calls.length, 0);
});

test("実行中の実行記録があるタスクは最初からのやり直しもできない", async () => {
  const runsDir = await makeDir();
  await saveRunningRecord(runsDir);
  const { run, calls } = stubRunner({ stdout: successStdout() });

  await assert.rejects(
    () =>
      runClaudeOpus({
        command: newCommand("最初からやり直す"),
        runsDir,
        runProcess: run,
        env: {},
        allowExistingTaskRun: true,
      }),
    /実行中です/,
  );
  assert.equal(calls.length, 0);
});

test("同じタスクのロックを別の入口が持っている間は起動しない", async () => {
  const runsDir = await makeDir();
  await acquireTaskLock({
    dir: taskLocksDir(runsDir),
    taskPath: "docs/tasks/example.md",
    pid: 4321,
    isProcessAlive: () => true,
  });
  const { run, calls } = stubRunner({ stdout: successStdout() });

  await assert.rejects(
    () =>
      runClaudeOpus({
        command: newCommand("実装する"),
        runsDir,
        runProcess: run,
        env: {},
        isProcessAlive: () => true,
      }),
    /実行中です/,
  );
  assert.equal(calls.length, 0);
  assert.equal((await readdir(runsDir)).length, 0);
});

test("同じタスクを同時に2回呼んでもClaudeを起動するのは1回だけ", async () => {
  const runsDir = await makeDir();
  let started: (() => void) | undefined;
  let finish: (() => void) | undefined;
  const processStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  const processMayFinish = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let calls = 0;
  const runProcess: ClaudeProcessRunner = async () => {
    calls += 1;
    started?.();
    await processMayFinish;
    return { exitCode: 0, stdout: successStdout(), stderr: "" };
  };

  const first = runClaudeOpus({
    command: newCommand("実装する"),
    runsDir,
    runProcess,
    env: {},
  });
  await processStarted;

  await assert.rejects(
    () =>
      runClaudeOpus({
        command: newCommand("同時に実装する"),
        runsDir,
        runProcess,
        env: {},
      }),
    /実行中です/,
  );
  assert.equal(calls, 1);

  finish?.();
  const output = await first;
  assert.equal(output.ok, true);
  assert.equal(calls, 1);
});

test("実行が終わるとロックを解放する", async () => {
  const runsDir = await makeDir();
  const output = await runClaudeOpus({
    command: newCommand("実装する"),
    runsDir,
    runProcess: stubRunner({ stdout: successStdout() }).run,
    env: {},
  });

  assert.equal(output.ok, true);
  assert.deepEqual(
    await readTaskLock(taskLockPath(taskLocksDir(runsDir), "docs/tasks/example.md")),
    { kind: "missing" },
  );
});

test("拒否したときもロックを残さない", async () => {
  const runsDir = await makeDir();
  await saveRunningRecord(runsDir);

  await assert.rejects(
    () =>
      runClaudeOpus({
        command: newCommand("実装する"),
        runsDir,
        runProcess: stubRunner({ stdout: successStdout() }).run,
        env: {},
      }),
    /実行中です/,
  );
  assert.deepEqual(
    await readTaskLock(taskLockPath(taskLocksDir(runsDir), "docs/tasks/example.md")),
    { kind: "missing" },
  );
});

test("異常終了で残ったロックを回収し、実行中のままの記録を再開できる形へ戻す", async () => {
  const runsDir = await makeDir();
  await saveRunningRecord(runsDir);
  await acquireTaskLock({
    dir: taskLocksDir(runsDir),
    taskPath: "docs/tasks/example.md",
    pid: 4321,
    isProcessAlive: () => true,
  });
  const { run, calls } = stubRunner({ stdout: successStdout() });

  const output = await runClaudeOpus({
    command: resumeCommand("20260901-101500-aaaaaaaa", "続きをやる"),
    runsDir,
    runProcess: run,
    env: {},
    isProcessAlive: () => false,
  });

  assert.equal(output.ok, true);
  assert.equal(output.run.runId, "20260901-101500-aaaaaaaa");
  assert.ok(calls[0].args.includes("aaaa-bbbb"));
});

test("接続確認はタスクのロックを取らない", async () => {
  const runsDir = await makeDir();
  const output = await runClaudeOpus({
    command: {
      kind: "check-auth",
      prompt: "Return exactly: AUTH_OK",
      taskPath: null,
      mode: null,
      executorRole: null,
    },
    runsDir,
    runProcess: stubRunner({ stdout: successStdout() }).run,
    env: {},
  });

  assert.equal(output.ok, true);
  await assert.rejects(() => readdir(taskLocksDir(runsDir)));
});

/** 中断の書き込みが終わるまで実行記録を読み直す。 */
async function waitForRunState(runsDir: string, runId: string, state: string): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const record = await loadRunRecord(runsDir, runId);
    if (record.state === state) return record.state;
    await new Promise((resolve) => setImmediate(resolve));
  }

  return (await loadRunRecord(runsDir, runId)).state;
}

/** 手で送るシグナルの受け取り。実際のプロセスへは送らない。 */
function manualSignals(): { source: ClaudeSignalSource; send: (signal: string) => void; listening: () => boolean } {
  const handlers = new Set<(signal: string) => void>();

  return {
    source: {
      listen(handler) {
        handlers.add(handler);
        return () => handlers.delete(handler);
      },
    },
    send: (signal) => {
      for (const handler of [...handlers]) handler(signal);
    },
    listening: () => handlers.size > 0,
  };
}

test("ストリームを受け取るたびに最終活動時刻と活動の要約を残す", async () => {
  const runsDir = await makeDir();
  const progress: ClaudeProgress[] = [];
  const seen: { state: string; kind: string | null; tool: string | null; eventCount: number }[] = [];

  const runProcess: ClaudeProcessRunner = async (input) => {
    await input.onStdoutChunk?.(
      `${JSON.stringify({ type: "system", subtype: "init", session_id: "aaaa-bbbb" })}\n`,
    );
    await input.onStdoutChunk?.(
      `${JSON.stringify({
        type: "assistant",
        session_id: "aaaa-bbbb",
        message: { content: [{ type: "tool_use", name: "Bash", input: { command: "psql" } }] },
      })}\n`,
    );
    const running = await loadRunRecord(runsDir, (await readdir(runsDir))[0].slice(0, -".json".length));
    seen.push({
      state: running.state,
      kind: running.lastActivityKind,
      tool: running.lastActivityTool,
      eventCount: running.eventCount,
    });
    await input.onStdoutChunk?.(`${successStdout({ session_id: "aaaa-bbbb" })}\n`);

    return { exitCode: 0, stdout: successStdout({ session_id: "aaaa-bbbb" }), stderr: "" };
  };

  const output = await runClaudeOpus({
    command: newCommand("実装する"),
    runsDir,
    runProcess,
    env: {},
    onProgress: (item) => progress.push(item),
  });

  assert.deepEqual(seen, [
    { state: "running", kind: "tool_use", tool: "Bash", eventCount: 2 },
  ]);
  assert.equal(output.run.eventCount, 3);
  assert.equal(output.run.lastActivityKind, "result");
  assert.equal(output.run.lastActivityTool, null);
  assert.ok(output.run.lastActivityAt !== null);
  assert.deepEqual(
    progress.map((item) => [item.eventCount, item.kind, item.toolName]),
    [
      [1, "startup", null],
      [2, "tool_use", "Bash"],
      [3, "result", null],
    ],
  );
  // 進捗にも実行記録にも、コマンドやツール結果は入れない。
  assert.equal(JSON.stringify(progress).includes("psql"), false);
});

test("中断されたら実行記録を未完了にし、中断理由を残してロックを解放する", async () => {
  const runsDir = await makeDir();
  const signals = manualSignals();
  let recordAtInterrupt: string | null = null;

  const runProcess: ClaudeProcessRunner = async (input) => {
    await input.onStdoutChunk?.(
      `${JSON.stringify({ type: "system", subtype: "init", session_id: "aaaa-bbbb" })}\n`,
    );
    signals.send("SIGINT");
    assert.equal(input.abort?.aborted, true);
    const runId = (await readdir(runsDir))[0].slice(0, -".json".length);
    // 子プロセスの終了を待たずに未完了へ戻すので、書き込みが終わるまで待って読む。
    recordAtInterrupt = await waitForRunState(runsDir, runId, "incomplete");

    // シグナルを受けた入口は子プロセスを終わらせる。終了コードは付かない。
    return { exitCode: null, stdout: JSON.stringify({ type: "system", session_id: "aaaa-bbbb" }), stderr: "" };
  };

  const output = await runClaudeOpus({
    command: newCommand("実装する"),
    runsDir,
    runProcess,
    env: {},
    signals: signals.source,
  });

  assert.equal(recordAtInterrupt, "incomplete");
  assert.equal(output.ok, false);
  assert.equal(output.run.state, "incomplete");
  assert.equal(output.run.failureKind, "interrupted");
  assert.match(output.run.error ?? "", /SIGINT で中断された/);
  assert.equal(output.error, output.run.error);
  assert.equal(output.run.sessionId, "aaaa-bbbb");
  assert.deepEqual(await loadRunRecord(runsDir, output.run.runId), output.run);
  assert.equal(signals.listening(), false);
  assert.deepEqual(await readdir(taskLocksDir(runsDir)), []);
});

test("中断のあとに最終結果が届いても完了にしない", async () => {
  const runsDir = await makeDir();
  const signals = manualSignals();

  const runProcess: ClaudeProcessRunner = async (input) => {
    signals.send("SIGTERM");
    await input.onStdoutChunk?.(`${successStdout()}\n`);

    return { exitCode: 0, stdout: successStdout(), stderr: "" };
  };

  const output = await runClaudeOpus({
    command: newCommand("実装する"),
    runsDir,
    runProcess,
    env: {},
    signals: signals.source,
  });

  assert.equal(output.ok, false);
  assert.equal(output.run.state, "incomplete");
  assert.equal(output.run.result, null);
  assert.match(output.run.error ?? "", /SIGTERM で中断された/);
});

test("中断されなければシグナルの受け取りをやめてから返す", async () => {
  const runsDir = await makeDir();
  const signals = manualSignals();

  await runClaudeOpus({
    command: newCommand("実装する"),
    runsDir,
    runProcess: stubRunner({ stdout: successStdout() }).run,
    env: {},
    signals: signals.source,
  });

  assert.equal(signals.listening(), false);
});

test("差し戻した再開が利用上限で失敗しても、前回の完了結果を失わない", async () => {
  const runsDir = await makeDir();
  const first = await runClaudeOpus({
    command: newCommand("実装する"),
    runsDir,
    runProcess: stubRunner({ stdout: successStdout({ result: "1件目を保存した" }) }).run,
    env: {},
  });

  assert.equal(first.run.state, "completed");
  assert.equal(first.run.completedResult, "1件目を保存した");

  const usageLimit = JSON.stringify({
    type: "result",
    subtype: "error_during_execution",
    is_error: true,
    result: "Claude AI usage limit reached|1757068800",
    terminal_reason: "api_error",
    modelUsage: { "claude-opus-5": {} },
    session_id: "11111111-2222-3333-4444-555555555555",
  });
  const resumed = await runClaudeOpus({
    command: resumeCommand(first.run.runId, "表現を直す"),
    runsDir,
    runProcess: stubRunner({ stdout: usageLimit }).run,
    env: {},
    reopenCompleted: true,
  });

  assert.equal(resumed.ok, false);
  assert.equal(resumed.run.state, "incomplete");
  assert.equal(resumed.run.failureKind, "usage_limit");
  assert.equal(resumed.run.result, null);
  assert.equal(resumed.run.completedResult, "1件目を保存した");
  assert.equal(resumed.run.completedAt, first.run.completedAt);
  assert.deepEqual(await loadRunRecord(runsDir, first.run.runId), resumed.run);
});
