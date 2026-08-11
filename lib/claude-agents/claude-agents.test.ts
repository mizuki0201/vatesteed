import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAgentMarkdown, extractDescription, quoteYamlString } from "./claude-agents.ts";

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

test("frontmatter と本文を組み立てる", () => {
  const markdown = buildAgentMarkdown({
    id: "horse-analyst",
    description: "馬を読む",
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

  assert.ok(markdown.endsWith("---\n\n本文"));
});
