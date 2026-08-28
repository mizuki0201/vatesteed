/**
 * Claude Code の入口。
 *
 *   pnpm claude:opus -- "依頼文"
 *   pnpm claude:opus -- --resume <実行記録のID> -- "続きの依頼文"
 *
 * 手順は docs/claude-code-bridge.md の「実行の単位と再開」が正本。
 */

import { spawn } from "node:child_process";
import path from "node:path";
import {
  CLAUDE_RUNS_DIR,
  type ClaudeProcessRunner,
  parseClaudeCommand,
  runClaudeOpus,
} from "../lib/claude-code/index.ts";

/** 子プロセスを起動し、標準出力と標準エラーを取る。 */
const runProcess: ClaudeProcessRunner = ({ args, env }) =>
  new Promise((resolve, reject) => {
    const child = spawn("claude", args, {
      cwd: process.cwd(),
      env: env as NodeJS.ProcessEnv,
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

    child.once("error", reject);
    child.once("close", (exitCode: number | null) => {
      resolve({ exitCode, stdout, stderr });
    });
  });

const argv = process.argv.slice(2);

try {
  const command = parseClaudeCommand(argv);
  const output = await runClaudeOpus({
    command,
    runsDir: path.join(process.cwd(), CLAUDE_RUNS_DIR),
    runProcess,
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
