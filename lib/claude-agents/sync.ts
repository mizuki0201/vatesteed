import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildAgentMarkdown, extractDescription, extractModel, needsPhase1DbAccess } from "./claude-agents.ts";

/**
 * `agent/subagents/` から `.claude/agents/` を生成し直す。
 *
 * - 正本は `agent/subagents/<id>/`。生成物は手で編集しない
 * - `<id>` がそのまま Claude Code 側の役の名前になる
 * - Phase 1 限りの手段（`phase1-db-access.md`）は、対象の役の本文の末尾に足す
 * - 正本から消えた役の生成物は削除する（名前を変えたときに古いものが残らないように）
 * - 中身が変わらないファイルは書き直さない
 *
 * 実行は `pnpm gen:agents`。編集のたびに Claude Code のフックからも走る。
 */

const SUBAGENTS_DIR = fileURLToPath(new URL("../../agent/subagents", import.meta.url));
const OUTPUT_DIR = fileURLToPath(new URL("../../.claude/agents", import.meta.url));
const PHASE1_DB_ACCESS = fileURLToPath(new URL("./phase1-db-access.md", import.meta.url));

/** 生成物だと分かる印。これが無いファイルは手書きとみなして消さない。 */
const GENERATED_MARKER = "# このファイルは自動生成される";

type SyncResult = {
  readonly written: readonly string[];
  readonly removed: readonly string[];
  readonly skipped: readonly string[];
};

async function readIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

export async function syncClaudeAgents(): Promise<SyncResult> {
  const entries = await readdir(SUBAGENTS_DIR, { withFileTypes: true }).catch(() => []);
  const ids = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

  // 読めなかったら落とす。足されないまま生成物を上書きするのが一番まずい
  const phase1DbAccess = await readFile(PHASE1_DB_ACCESS, "utf8").catch((error: unknown) => {
    throw new Error(`${path.relative(process.cwd(), PHASE1_DB_ACCESS)} を読めません。`, {
      cause: error,
    });
  });

  await mkdir(OUTPUT_DIR, { recursive: true });

  const written: string[] = [];
  const skipped: string[] = [];

  for (const id of ids) {
    const agentSource = await readIfExists(path.join(SUBAGENTS_DIR, id, "agent.ts"));
    const body = await readIfExists(path.join(SUBAGENTS_DIR, id, "instructions.md"));

    if (agentSource === undefined || body === undefined) {
      skipped.push(`${id}（agent.ts か instructions.md が無い）`);
      continue;
    }

    const description = extractDescription(agentSource);
    if (description === undefined) {
      skipped.push(`${id}（agent.ts から description を読めない）`);
      continue;
    }

    const model = extractModel(agentSource);

    const markdown = buildAgentMarkdown({
      id,
      description,
      model,
      body,
      appendix: needsPhase1DbAccess(id) ? phase1DbAccess : undefined,
    });
    const outputPath = path.join(OUTPUT_DIR, `${id}.md`);

    if ((await readIfExists(outputPath)) === markdown) continue;

    await writeFile(outputPath, markdown, "utf8");
    written.push(id);
  }

  const removed: string[] = [];
  const existing = await readdir(OUTPUT_DIR, { withFileTypes: true }).catch(() => []);

  for (const entry of existing) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    if (ids.includes(entry.name.slice(0, -".md".length))) continue;

    const outputPath = path.join(OUTPUT_DIR, entry.name);
    const contents = await readIfExists(outputPath);
    if (contents === undefined || !contents.includes(GENERATED_MARKER)) continue;

    await rm(outputPath);
    removed.push(entry.name);
  }

  return { written, removed, skipped };
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const result = await syncClaudeAgents();

  for (const id of result.written) console.log(`生成: ${id}`);
  for (const name of result.removed) console.log(`削除: ${name}`);
  for (const note of result.skipped) console.warn(`スキップ: ${note}`);

  if (result.written.length === 0 && result.removed.length === 0) {
    console.log(".claude/agents/ は最新。");
  }
}
