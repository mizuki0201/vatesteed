/**
 * Claude Code の入口。
 *
 *   pnpm claude:opus -- --check-auth
 *   pnpm claude:opus -- --task docs/tasks/<タスク名>.md
 *   pnpm claude:opus -- --resume <実行記録のID> --task docs/tasks/<タスク名>.md
 *   pnpm claude:opus -- --restart --task docs/tasks/<タスク名>.md
 *
 * 手順は docs/claude-code-bridge.md の「実行の単位と再開」が正本。
 *
 * レビュー修正の往復を記録するのも、この入口の責務である。**Claude Code へ渡す依頼文には
 * 記録のことを一切書かない**（docs/claude-code-bridge.md の「レビューと修正回答の記録」）。
 */

import { spawn } from "node:child_process";
import path from "node:path";
import {
  CLAUDE_RUNS_DIR,
  assertClaudeExecutableTask,
  buildTaskPrompt,
  type ClaudeCliCommand,
  type ClaudeCommand,
  type ClaudeProcessRunner,
  type ClaudeProgress,
  createProgressFilter,
  formatActivityLine,
  loadTaskContract,
  parseClaudeCommand,
  runClaudeOpus,
  type TaskContract,
} from "../lib/claude-code/index.ts";
import {
  openReviewRound,
  recordReviewReport,
  REVIEW_RUNS_DIR,
} from "../lib/review-runs/index.ts";

/** 子プロセスを起動し、標準出力と標準エラーを取る。 */
const runProcess: ClaudeProcessRunner = (input) =>
  new Promise((resolve, reject) => {
    const child = spawn("claude", input.args, {
      cwd: process.cwd(),
      env: input.env as NodeJS.ProcessEnv,
      stdio: ["ignore", "pipe", "pipe"] as const,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    let stdoutUpdates = Promise.resolve();
    child.stdout.on("data", (chunk: string) => {
      if (input.onStdoutChunk !== undefined) {
        stdoutUpdates = stdoutUpdates.then(() => input.onStdoutChunk?.(chunk));
      }
    });

    // 入口が中断されたら、子プロセスも終わらせてから後始末に進む。
    input.abort?.addEventListener("abort", () => child.kill("SIGTERM"), { once: true });

    child.once("error", reject);
    child.once("close", (exitCode: number | null) => {
      stdoutUpdates.then(
        () => resolve({ exitCode, stdout, stderr }),
        reject,
      );
    });
  });

/** 進捗表示を最大1分に1回へ抑え、連携自体でCodexの文脈を増やしすぎない。 */
const PROGRESS_INTERVAL_MS = 60_000;

/**
 * 実行中の進捗を標準エラーへ出す。
 *
 * 標準出力は最後のJSONだけにしておく。**本文もコマンドもツール結果も出さない。**
 */
function createProgressWriter(): (progress: ClaudeProgress) => void {
  const shouldShow = createProgressFilter(PROGRESS_INTERVAL_MS);

  return (progress) => {
    if (!shouldShow(progress)) return;
    process.stderr.write(`${formatActivityLine(progress)}\n`);
  };
}

/** 検証済みのタスクから実行処理へ渡す値を組み立てる。接続確認にはタスクが無い。 */
async function buildCommand(
  parsed: ClaudeCliCommand,
): Promise<{ command: ClaudeCommand; task: TaskContract | null }> {
  if (parsed.kind === "check-auth") {
    return {
      command: {
        kind: "check-auth",
        prompt: "Return exactly: AUTH_OK",
        taskPath: null,
        mode: null,
        executorRole: null,
      },
      task: null,
    };
  }

  const task = await loadTaskContract(process.cwd(), parsed.taskPath);
  assertClaudeExecutableTask(task);
  const shared = {
    prompt: buildTaskPrompt(task, parsed.kind === "resume"),
    taskPath: task.taskPath,
    mode: task.mode,
    executorRole: task.executorRole,
  };

  return {
    command:
      parsed.kind === "resume"
        ? { kind: "resume", runId: parsed.runId, ...shared }
        : { kind: "new", ...shared },
    task,
  };
}

const argv = process.argv.slice(2);

try {
  const parsed = parseClaudeCommand(argv);
  const { command, task } = await buildCommand(parsed);
  const reviewsDir = path.join(process.cwd(), REVIEW_RUNS_DIR);

  const output = await runClaudeOpus({
    command,
    runsDir: path.join(process.cwd(), CLAUDE_RUNS_DIR),
    runProcess,
    reopenCompleted: parsed.kind === "resume",
    allowExistingTaskRun: parsed.kind === "restart",
    onProgress: createProgressWriter(),
    // 差し戻して再開すると決まった時点で、タスクMarkdownの「受け入れ結果」から指摘を読む。
    onSendBack:
      task === null
        ? undefined
        : async (run) => {
            await openReviewRound({ dir: reviewsDir, runId: run.runId, taskBody: task.body });
          },
    onCompleted:
      task === null
        ? undefined
        : async (run) => {
            if (run.result === null) return;
            await recordReviewReport({
              dir: reviewsDir,
              runId: run.runId,
              taskPath: task.taskPath,
              taskTitle: task.title,
              mode: task.mode,
              report: run.result,
            });
          },
  });

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = output.ok ? 0 : 1;
} catch (error) {
  // 実行記録を作る前に落ちた場合。再開の依頼なら、どの実行記録の話かは分かる。
  const runId = argv.includes("--resume") ? (argv[argv.indexOf("--resume") + 1] ?? null) : null;

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: false,
        runId,
        state: "incomplete",
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    )}\n`,
  );
  process.exitCode = 1;
}
