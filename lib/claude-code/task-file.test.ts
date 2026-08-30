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
    ? `## 正本となる設計\n設計\n## 実装範囲\n範囲\n## 対象外\n対象外\n## 変更結果\n未変更\n## テスト結果\n未実行\n## 受け入れ結果\n未確認\n`
    : `## 分析対象\n馬\n## 対象ごとの進捗\n未完了\n## DBへの保存結果\n未保存\n## 参照元\nURL\n## 未登録・未分析\nあり\n`;
}

async function fixture(input: {
  mode?: string;
  coordinator?: string;
  executor?: string;
  executorRole?: string;
  preparationStatus?: string;
  status?: string;
  sections?: string;
  /** 役の指示を置かない場合に立てる */
  withoutRoleInstructions?: boolean;
} = {}): Promise<{ root: string; taskPath: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "vatesteed-task-"));
  await mkdir(path.join(root, "docs/tasks"), { recursive: true });
  const taskPath = "docs/tasks/example.md";
  const mode = input.mode ?? "development";
  const executorRole = input.executorRole ?? "dev-implementer";
  await mkdir(path.join(root, "agent"), { recursive: true });
  await writeFile(path.join(root, "agent/instructions.md"), "オーケストレーターの指示\n", "utf8");
  if (input.withoutRoleInstructions !== true) {
    await mkdir(path.join(root, "agent/subagents", executorRole), { recursive: true });
    await writeFile(
      path.join(root, "agent/subagents", executorRole, "instructions.md"),
      "役の指示\n",
      "utf8",
    );
  }
  await writeFile(
    path.join(root, taskPath),
    `---\ntitle: 例\narea: ops\nmode: ${mode}\ncoordinator: ${input.coordinator ?? "codex"}\nexecutor: ${input.executor ?? "claude-code"}\nexecutor_role: ${executorRole}\npreparation_status: ${input.preparationStatus ?? "ready"}\nstatus: ${input.status ?? "doing"}\ncreated: 2026-08-31\nupdated: 2026-08-31\n---\n${commonSections}${input.sections ?? modeSections(mode as TaskMode)}`,
    "utf8",
  );
  return { root, taskPath };
}

test("開発タスクを読み、実行元と役を別々に持つ", async () => {
  const { root, taskPath } = await fixture();
  const task = await loadTaskContract(root, taskPath);
  assert.equal(task.mode, "development");
  assert.equal(task.coordinator, "codex");
  assert.equal(task.executor, "claude-code");
  assert.equal(task.executorRole, "dev-implementer");
  assert.equal(task.preparationStatus, "ready");
  assert.equal(task.roleInstructionPath, "agent/subagents/dev-implementer/instructions.md");

  const prompt = buildTaskPrompt(task, false);
  assert.match(prompt, /dev-implementer/);
  assert.match(prompt, /agent\/subagents\/dev-implementer\/instructions\.md/);
  assert.match(prompt, /status: done.*進行役のCodex/u);
  assert.match(prompt, /「受け入れ結果」は進行役が更新する/);
});

test("Codex単体のタスクは同じ実行元が受け入れまで行う", async () => {
  const { root, taskPath } = await fixture({ coordinator: "codex", executor: "codex" });
  const task = await loadTaskContract(root, taskPath);
  const prompt = buildTaskPrompt(task, false);
  assert.match(prompt, /status: doneは、自分で成果物を読み直して/);
  assert.doesNotMatch(prompt, /自分では変更しない/);
});

test("Claude Code単体のタスクは同じ実行元が受け入れまで行う", async () => {
  const { root, taskPath } = await fixture({
    coordinator: "claude-code",
    executor: "claude-code",
  });
  const task = await loadTaskContract(root, taskPath);
  assert.match(buildTaskPrompt(task, false), /status: doneは、自分で成果物を読み直して/);
});

test("使わない進行役と実行元の組み合わせを弾く", async () => {
  const { root, taskPath } = await fixture({
    coordinator: "claude-code",
    executor: "codex",
  });
  await assert.rejects(() => loadTaskContract(root, taskPath), /組み合わせ/);
});

test("executor_roleに実行元を書かせない", async () => {
  for (const executorRole of ["codex", "claude-code"]) {
    const { root, taskPath } = await fixture({ executorRole });
    await assert.rejects(() => loadTaskContract(root, taskPath), /実行元ではなく役/);
  }
});

test("競馬タスクは渡された調査の照合とDB確認を指示する", async () => {
  const { root, taskPath } = await fixture({
    mode: "racing",
    executorRole: "entry-analyst",
  });
  const task = await loadTaskContract(root, taskPath);
  const prompt = buildTaskPrompt(task, true);
  assert.match(prompt, /「事前調査」「参照元」に渡された資料とDBを先に照合/);
  assert.match(prompt, /判断に影響するときだけ、確かめる範囲を決めて追加調査/);
  assert.match(prompt, /DBを読み直して確認/);
  assert.match(prompt, /コードと設計docsは変更しない/);
  assert.match(prompt, /同じClaude Codeセッションの再開/);
});

test("複数の役が要る競馬タスクはオーケストレーターとして1セッションで実行する", async () => {
  const { root, taskPath } = await fixture({
    mode: "racing",
    executorRole: "orchestrator",
  });
  const task = await loadTaskContract(root, taskPath);
  assert.equal(task.roleInstructionPath, "agent/instructions.md");

  const prompt = buildTaskPrompt(task, false);
  assert.match(prompt, /agent\/instructions\.md を全文読み/);
  assert.match(prompt, /専門役の agent\/subagents\/<役>\/instructions\.md を必要な順に読み/);
  assert.match(prompt, /子エージェントを起動しない/);
});

test("modeと役が合わないタスクを弾く", async () => {
  const { root, taskPath } = await fixture({ executorRole: "entry-analyst" });
  await assert.rejects(() => loadTaskContract(root, taskPath), /dev-で始まる/);
});

test("指示が無い役を指定したタスクを弾く", async () => {
  const { root, taskPath } = await fixture({
    executorRole: "dev-unknown",
    withoutRoleInstructions: true,
  });
  await assert.rejects(() => loadTaskContract(root, taskPath), /指示が見つかりません/);
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

test("Codexが実行するタスクをClaude Codeの入口へ渡さない", async () => {
  const { root, taskPath } = await fixture({ coordinator: "codex", executor: "codex" });
  const task = await loadTaskContract(root, taskPath);
  assert.throws(() => assertClaudeExecutableTask(task), /executorが codex/);
});

test("直接起動したClaude CodeのタスクをClaude Codeの入口へ渡さない", async () => {
  const { root, taskPath } = await fixture({
    coordinator: "claude-code",
    executor: "claude-code",
  });
  const task = await loadTaskContract(root, taskPath);
  assert.throws(() => assertClaudeExecutableTask(task), /Codexが進行役のタスクだけ/);
});

test("準備が終わっていないタスクをClaude Codeへ渡さない", async () => {
  const { root, taskPath } = await fixture({ preparationStatus: "preparing" });
  const task = await loadTaskContract(root, taskPath);
  assert.throws(() => assertClaudeExecutableTask(task), /preparation_status を ready/);
});

test("todoとdoneのタスクをClaudeへ渡さない", async () => {
  for (const status of ["todo", "done"] as const) {
    const { root, taskPath } = await fixture({ status });
    const task = await loadTaskContract(root, taskPath);
    assert.throws(() => assertClaudeExecutableTask(task), new RegExp(status === "todo" ? "doing" : "完了済み"));
  }
});
