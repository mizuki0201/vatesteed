import assert from "node:assert/strict";
import { test } from "node:test";
import { createActivityTracker, formatActivityLine } from "./activity.ts";

function line(event: Record<string, unknown>): string {
  return `${JSON.stringify(event)}\n`;
}

const SESSION_ID = "11111111-2222-3333-4444-555555555555";

test("文章生成を直近の活動として数える", () => {
  const tracker = createActivityTracker();
  const activity = tracker.push(
    line({
      type: "assistant",
      session_id: SESSION_ID,
      message: { content: [{ type: "text", text: "ディープインパクトの評価を書く" }] },
    }),
  );

  assert.deepEqual(activity, {
    eventCount: 1,
    kind: "text",
    toolName: null,
    sessionId: SESSION_ID,
  });
});

test("ツール実行はツール名まで残し、コマンドは残さない", () => {
  const tracker = createActivityTracker();
  const activity = tracker.push(
    line({
      type: "assistant",
      session_id: SESSION_ID,
      message: {
        content: [
          { type: "text", text: "DBを見る" },
          { type: "tool_use", name: "Bash", input: { command: "psql -c 'select 1'" } },
        ],
      },
    }),
  );

  assert.equal(activity?.kind, "tool_use");
  assert.equal(activity?.toolName, "Bash");
  assert.equal(JSON.stringify(activity).includes("psql"), false);
});

test("ツール結果と最終結果を種類として分ける", () => {
  const tracker = createActivityTracker();
  tracker.push(
    line({
      type: "user",
      session_id: SESSION_ID,
      message: { content: [{ type: "tool_result", content: "馬 332 の出走履歴" }] },
    }),
  );
  assert.equal(tracker.snapshot().kind, "tool_result");

  const activity = tracker.push(line({ type: "result", session_id: SESSION_ID }));
  assert.equal(activity?.kind, "result");
  assert.equal(activity?.eventCount, 2);
});

test("起動時のイベントからセッションIDを拾う", () => {
  const tracker = createActivityTracker();
  const activity = tracker.push(line({ type: "system", subtype: "init", session_id: SESSION_ID }));

  assert.equal(activity?.kind, "startup");
  assert.equal(activity?.sessionId, SESSION_ID);
});

test("行の途中で切れた断片は、改行がそろってから読む", () => {
  const tracker = createActivityTracker();
  const whole = line({
    type: "assistant",
    session_id: SESSION_ID,
    message: { content: [{ type: "tool_use", name: "Read" }] },
  });

  assert.equal(tracker.push(whole.slice(0, 20)), null);
  assert.equal(tracker.snapshot().eventCount, 0);

  const activity = tracker.push(whole.slice(20));
  assert.equal(activity?.eventCount, 1);
  assert.equal(activity?.toolName, "Read");
});

test("1つの断片に複数のイベントが入っていても全部数える", () => {
  const tracker = createActivityTracker();
  const activity = tracker.push(
    [
      line({ type: "system", session_id: SESSION_ID }),
      line({ type: "assistant", session_id: SESSION_ID, message: { content: [] } }),
      line({ type: "assistant", session_id: SESSION_ID, message: { content: [{ type: "tool_use", name: "Grep" }] } }),
    ].join(""),
  );

  assert.equal(activity?.eventCount, 3);
  assert.equal(activity?.kind, "tool_use");
  assert.equal(activity?.toolName, "Grep");
});

test("種類を判定できないイベントでも、受け取った数と直前の種類は残す", () => {
  const tracker = createActivityTracker();
  tracker.push(
    line({
      type: "assistant",
      session_id: SESSION_ID,
      message: { content: [{ type: "tool_use", name: "Bash" }] },
    }),
  );
  const activity = tracker.push(line({ type: "stream_event", session_id: SESSION_ID }));

  assert.equal(activity?.eventCount, 2);
  assert.equal(activity?.kind, "tool_use");
  assert.equal(activity?.toolName, "Bash");
});

test("JSONとして読めない行があっても止まらない", () => {
  const tracker = createActivityTracker();
  const activity = tracker.push(`Claude AI usage limit reached\n${line({ type: "result" })}`);

  assert.equal(activity?.eventCount, 1);
  assert.equal(activity?.kind, "result");
});

test("長いツール名と制御文字は表示できる形に整える", () => {
  const tracker = createActivityTracker();
  const activity = tracker.push(
    line({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: `mcp__${"a".repeat(80)}\nrm -rf` }] },
    }),
  );

  assert.equal(activity?.toolName?.includes("\n"), false);
  assert.equal(activity?.toolName?.length, 61);
});

test("進捗の1行に本文もコマンドも出さない", () => {
  const written = formatActivityLine({
    runId: "20260905-201421-255553c6",
    eventCount: 23,
    kind: "tool_use",
    toolName: "Bash",
    at: "2026-09-05T11:14:21.000Z",
  });

  assert.match(written, /20260905-201421-255553c6/);
  assert.match(written, /23件/);
  assert.match(written, /ツール実行 Bash/);
});

test("種類がまだ分からないときも進捗を1行にできる", () => {
  const written = formatActivityLine({
    runId: "20260905-201421-255553c6",
    eventCount: 1,
    kind: null,
    toolName: null,
    at: "2026-09-05T11:14:21.000Z",
  });

  assert.match(written, /1件 受信/);
});
