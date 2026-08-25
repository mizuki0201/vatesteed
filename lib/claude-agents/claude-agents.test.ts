import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildAgentMarkdown,
  CLAUDE_OPUS_MODEL,
  extractDescription,
  extractModel,
  isClaudeOpusModel,
  needsPhase1DbAccess,
  quoteYamlString,
} from "./claude-agents.ts";

test("description を二重引用符で包む", () => {
  assert.equal(quoteYamlString("馬を読む"), '"馬を読む"');
});

test("引用符とバックスラッシュを escape する", () => {
  assert.equal(quoteYamlString('「"叩き"」\\'), '"「\\"叩き\\"」\\\\"');
});

test("コロンを含む description が YAML に食われない形になる", () => {
  // 素で置くと YAML のキーと値の区切りに見えてしまう。
  assert.equal(quoteYamlString("対象: 馬"), '"対象: 馬"');
});

test("agent.ts のソースから description を取り出す", () => {
  const source = [
    'import { defineAgent } from "eve";',
    "",
    "export default defineAgent({",
    '  description: "1頭の馬を総合して評価するときに使う。",',
    '  model: "anthropic/claude-sonnet-5",',
    "});",
  ].join("\n");

  assert.equal(extractDescription(source), "1頭の馬を総合して評価するときに使う。");
});

test("description に escape された引用符が入っていても戻す", () => {
  const source = 'export default defineAgent({ description: "「\\"叩き\\"」を読む" });';

  assert.equal(extractDescription(source), '「"叩き"」を読む');
});

test("description が無ければ undefined", () => {
  assert.equal(extractDescription('export default defineAgent({ model: "x" });'), undefined);
});

test("agent.ts のソースから model を取り出す", () => {
  const source = 'export default defineAgent({ model: "anthropic/claude-opus-5" });';

  assert.equal(extractModel(source), "anthropic/claude-opus-5");
});

test("Opus 以外のモデルは生成対象にしない", () => {
  assert.equal(isClaudeOpusModel(CLAUDE_OPUS_MODEL), true);
  assert.equal(isClaudeOpusModel("anthropic/claude-sonnet-5"), false);
  assert.equal(isClaudeOpusModel(undefined), false);
});

test("frontmatter と本文を組み立てる", () => {
  const markdown = buildAgentMarkdown({
    id: "horse-analyst",
    description: "馬を読む",
    model: "anthropic/claude-opus-5",
    body: "# 馬を読む役\n\n本文。\n",
  });

  assert.equal(
    markdown,
    [
      "---",
      "# このファイルは自動生成される。手で編集しても pnpm gen:agents で上書きされる。",
      "# 正本は agent/subagents/horse-analyst/",
      "name: horse-analyst",
      'description: "馬を読む"',
      "model: claude-opus-5",
      "---",
      "",
      "# 馬を読む役",
      "",
      "本文。",
      "",
    ].join("\n"),
  );
});

test("本文の先頭の空行は落とす", () => {
  const markdown = buildAgentMarkdown({ id: "x", description: "d", body: "\n\n本文" });

  assert.ok(markdown.endsWith("---\n\n本文\n"));
});

test("appendix を渡すと本文の末尾に空行1つを挟んで足す", () => {
  const markdown = buildAgentMarkdown({
    id: "x",
    description: "d",
    body: "本文。\n",
    appendix: "## 足す節\n\n中身。\n",
  });

  assert.ok(markdown.endsWith("本文。\n\n## 足す節\n\n中身。\n"));
});

test("appendix を渡さなければ出力は今までと同じ", () => {
  const input = { id: "x", description: "d", body: "本文。\n" };

  assert.equal(buildAgentMarkdown({ ...input, appendix: undefined }), buildAgentMarkdown(input));
  assert.ok(buildAgentMarkdown(input).endsWith("本文。\n"));
});

test("末尾は appendix の有無によらず改行1つで閉じる", () => {
  // 正本の末尾に空行がいくつあっても、生成物の形が変わらないようにする。
  const bodies = ["本文。", "本文。\n", "本文。\n\n\n"];

  for (const body of bodies) {
    assert.ok(
      buildAgentMarkdown({ id: "x", description: "d", body }).endsWith("本文。\n"),
      `appendix なし: ${JSON.stringify(body)}`,
    );
    assert.ok(
      buildAgentMarkdown({ id: "x", description: "d", body, appendix: "節\n\n\n" }).endsWith(
        "本文。\n\n節\n",
      ),
      `appendix あり: ${JSON.stringify(body)}`,
    );
  }
});

test("dev- で始まる開発の役には Phase 1 の手段を足さない", () => {
  // 開発の役は DB を触らない。
  assert.equal(needsPhase1DbAccess("dev-implementer"), false);
  assert.equal(needsPhase1DbAccess("dev-explorer"), false);
});

test("分析する役と検証する役には Phase 1 の手段を足す", () => {
  assert.equal(needsPhase1DbAccess("entry-analyst"), true);
  assert.equal(needsPhase1DbAccess("verifier"), true);
});
