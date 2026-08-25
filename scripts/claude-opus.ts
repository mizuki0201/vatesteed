import { spawn } from "node:child_process";
import { buildClaudeOpusArgs, extractClaudePrompt } from "../lib/claude-code/index.ts";

const prompt = extractClaudePrompt(process.argv.slice(2));

const child = spawn("claude", buildClaudeOpusArgs(prompt), {
  cwd: process.cwd(),
  stdio: "inherit",
});

const exitCode = await new Promise<number | null>((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", resolve);
});

process.exitCode = exitCode ?? 1;
