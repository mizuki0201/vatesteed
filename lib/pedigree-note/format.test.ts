import assert from "node:assert/strict";
import test from "node:test";
import { formatPedigreeNoteBody } from "./format.ts";

test("既定の見出し名だけの行を Markdown の見出しにする", () => {
  const body = [
    "概要",
    "",
    "父と母について。",
    "",
    "母と牝系",
    "",
    "母と近親について。",
    "",
    "産駒の傾向",
    "",
    "父の子について。",
    "",
    "母父と配合",
    "",
    "母父について。",
    "",
    "系統とクロス",
    "",
    "クロスについて。",
    "",
    "適性の素地",
    "",
    "距離について。",
  ].join("\n");

  const formatted = formatPedigreeNoteBody(body);

  for (const heading of [
    "概要",
    "母と牝系",
    "産駒の傾向",
    "母父と配合",
    "系統とクロス",
    "適性の素地",
  ]) {
    assert.match(formatted, new RegExp(`^## ${heading}$`, "m"));
  }
});

test("既に Markdown の見出しになっている行は変更しない", () => {
  const body = "## 概要\n\n父と母について。";

  assert.equal(formatPedigreeNoteBody(body), body);
});

test("文章中の見出し名と既定外の独立行は変更しない", () => {
  const body = "母と牝系では長い距離の材料がある。\n\n補足\n\n材料は限られる。";

  assert.equal(formatPedigreeNoteBody(body), body);
});
