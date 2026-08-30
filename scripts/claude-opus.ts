/**
 * Claude Code の入口。
 *
 *   pnpm claude:opus -- --check-auth
 *   pnpm claude:opus -- --task docs/tasks/<タスク名>.md
 *   pnpm claude:opus -- --resume <実行記録のID> --task docs/tasks/<タスク名>.md
 *   pnpm claude:opus -- --restart --task docs/tasks/<タスク名>.md
 *
 * 手順は docs/claude-code-bridge.md の「実行の単位と再開」が正本。
 */

import { spawn } from "node:child_process";
import path from "node:path";
import {
  CLAUDE_RUNS_DIR,
  assertClaudeExecutableTask,
  buildTaskPrompt,
  type ClaudeProcessRunner,
  loadTaskContract,
  parseClaudeCommand,
  runClaudeOpus,
} from "../lib/claude-code/index.ts";

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

    child.once("error", reject);
    child.once("close", (exitCode: number | null) => {
      stdoutUpdates.then(
        () => resolve({ exitCode, stdout, stderr }),
        reject,
      );
    });
  });

const argv = process.argv.slice(2);

try {
  const parsed = parseClaudeCommand(argv);
  const command =
    parsed.kind === "check-auth"
      ? {
          kind: "check-auth" as const,
          prompt: "Return exactly: AUTH_OK",
          taskPath: null,
          mode: null,
          executorRole: null,
        }
      : await (async () => {
          const task = await loadTaskContract(process.cwd(), parsed.taskPath);
          assertClaudeExecutableTask(task);
          const shared = {
            prompt: buildTaskPrompt(task, parsed.kind === "resume"),
            taskPath: task.taskPath,
            mode: task.mode,
            executorRole: task.executorRole,
          };
          return parsed.kind === "new" || parsed.kind === "restart"
            ? { kind: "new" as const, ...shared }
            : { kind: "resume" as const, runId: parsed.runId, ...shared };
        })();
  const output = await runClaudeOpus({
    command,
    runsDir: path.join(process.cwd(), CLAUDE_RUNS_DIR),
    runProcess,
    reopenCompleted: parsed.kind === "resume",
    allowExistingTaskRun: parsed.kind === "restart",
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
