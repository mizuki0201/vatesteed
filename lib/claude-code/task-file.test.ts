import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  assertClaudeExecutableTask,
  buildTaskPrompt,
  loadTaskContract,
  type TaskMode,
} from "./task-file.ts";

const commonSections = `
## なぜ
理由
## 依頼
依頼
## 完了条件
- [ ] 終わる
## 実行上の制約
制約
## 事前調査
調査
## 現在地
現在地
## 問題点
なし
## 保存確認
未確認
## 作業記録
記録
## 参照
参照
`;

function modeSections(mode: TaskMode): string {
  return mode === "development"
    ? `## 正本となる設計\n設計\n## 実装範囲\n範囲\n## 対象外\n対象外\n## 変更結果\n未変更\n## テスト結果\n未実行\n## Codexの受け入れ結果\n未確認\n`
    : `## 分析対象\n馬\n## 対象ごとの進捗\n未完了\n## DBへの保存結果\n未保存\n## 参照元\nURL\n## 未登録・未分析\nあり\n`;
}

async function fixture(input: {
  mode?: string;
  executorRole?: string;
  status?: string;
  sections?: string;
} = {}): Promise<{ root: string; taskPath: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "vatesteed-task-"));
  await mkdir(path.join(root, "docs/tasks"), { recursive: true });
  const taskPath = "docs/tasks/example.md";
  const mode = input.mode ?? "development";
  const executorRole = input.executorRole ?? "dev-implementer";
  if (executorRole !== "codex") {
    await mkdir(path.join(root, "agent/subagents", executorRole), { recursive: true });
    await writeFile(
      path.join(root, "agent/subagents", executorRole, "instructions.md"),
      "役の指示\n",
      "utf8",
    );
  }
  await writeFile(
    path.join(root, taskPath),
    `---\ntitle: 例\narea: ops\nmode: ${mode}\nexecutor_role: ${executorRole}\nstatus: ${input.status ?? "doing"}\ncreated: 2026-08-31\nupdated: 2026-08-31\n---\n${commonSections}${input.sections ?? modeSections(mode as TaskMode)}`,
    "utf8",
  );
  return { root, taskPath };
}

test("開発タスクを読み、Claudeへ渡す指示を作る", async () => {
  const { root, taskPath } = await fixture();
  const task = await loadTaskContract(root, taskPath);
  assert.equal(task.mode, "development");
  assert.equal(task.executorRole, "dev-implementer");
  assert.match(buildTaskPrompt(task, false), /dev-implementer/);
  assert.match(buildTaskPrompt(task, false), /agent\/subagents\/dev-implementer\/instructions\.md/);
  assert.match(buildTaskPrompt(task, false), /status: done.*Codex/u);
});

test("競馬タスクはDB確認とコード変更禁止を指示する", async () => {
  const { root, taskPath } = await fixture({
    mode: "racing",
    executorRole: "entry-analyst",
  });
  const task = await loadTaskContract(root, taskPath);
  const prompt = buildTaskPrompt(task, true);
  assert.match(prompt, /DBを読み直して確認/);
  assert.match(prompt, /コードと設計docsは変更しない/);
  assert.match(prompt, /同じClaude Codeセッションの再開/);
});

test("modeと役が合わないタスクを弾く", async () => {
  const { root, taskPath } = await fixture({ executorRole: "entry-analyst" });
  await assert.rejects(() => loadTaskContract(root, taskPath), /dev-で始まる/);
});

test("モード別の必須項目が無いタスクを弾く", async () => {
  const { root, taskPath } = await fixture({ sections: "" });
  await assert.rejects(() => loadTaskContract(root, taskPath), /正本となる設計/);
});

test("開発と競馬の項目を1つのタスクへ混ぜない", async () => {
  const { root, taskPath } = await fixture({
    sections: `${modeSections("development")}## 分析対象\n馬\n`,
  });
  await assert.rejects(() => loadTaskContract(root, taskPath), /混在させられません/);
});

test("docs/tasks直下以外を読まない", async () => {
  const { root } = await fixture();
  await assert.rejects(() => loadTaskContract(root, "../outside.md"), /docs\/tasks\/直下/);
});

test("Codexが実行するタスクをClaudeへ渡さない", async () => {
  const { root, taskPath } = await fixture({ executorRole: "codex" });
  const task = await loadTaskContract(root, taskPath);
  assert.throws(() => assertClaudeExecutableTask(task), /codex/);
});

test("todoとdoneのタスクをClaudeへ渡さない", async () => {
  for (const status of ["todo", "done"] as const) {
    const { root, taskPath } = await fixture({ status });
    const task = await loadTaskContract(root, taskPath);
    assert.throws(() => assertClaudeExecutableTask(task), new RegExp(status === "todo" ? "doing" : "完了済み"));
  }
});
