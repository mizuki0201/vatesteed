import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  acquireTaskLock,
  readTaskLock,
  taskLockPath,
  taskLocksDir,
} from "./task-lock.ts";

const TASK = "docs/tasks/example.md";

async function makeDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vatesteed-lock-"));
}

const alive = (): boolean => true;
const dead = (): boolean => false;

test("ロックは実行記録の隣に置く", async () => {
  assert.equal(taskLocksDir("/repo/.claude/runs"), "/repo/.claude/runs-locks");
  assert.equal(
    path.basename(taskLockPath("/locks", TASK)).startsWith("example-"),
    true,
  );
});

test("同じタスクのロックを2つ取れない", async () => {
  const dir = await makeDir();
  await acquireTaskLock({ dir, taskPath: TASK, pid: 100, isProcessAlive: alive });

  await assert.rejects(
    () => acquireTaskLock({ dir, taskPath: TASK, pid: 200, isProcessAlive: alive }),
    /実行中です/,
  );
});

test("別のタスクなら同時にロックを取れる", async () => {
  const dir = await makeDir();
  const first = await acquireTaskLock({ dir, taskPath: TASK, pid: 100, isProcessAlive: alive });
  const second = await acquireTaskLock({
    dir,
    taskPath: "docs/tasks/other.md",
    pid: 200,
    isProcessAlive: alive,
  });

  assert.notEqual(first.path, second.path);
  assert.equal(second.reclaimedFrom, null);
});

test("解放したロックは次の入口が取れる", async () => {
  const dir = await makeDir();
  const first = await acquireTaskLock({ dir, taskPath: TASK, pid: 100, isProcessAlive: alive });
  await first.release();

  assert.deepEqual(await readTaskLock(first.path), { kind: "missing" });

  const second = await acquireTaskLock({ dir, taskPath: TASK, pid: 200, isProcessAlive: alive });
  assert.equal(second.reclaimedFrom, null);
});

test("持ち主のプロセスが無いロックだけ回収する", async () => {
  const dir = await makeDir();
  await acquireTaskLock({ dir, taskPath: TASK, pid: 100, isProcessAlive: alive });

  const reclaimed = await acquireTaskLock({
    dir,
    taskPath: TASK,
    pid: 200,
    isProcessAlive: dead,
  });

  assert.equal(reclaimed.reclaimedFrom, 100);
  assert.equal(reclaimed.lock.pid, 200);
});

test("読めないロックは回収せず、人が確かめるまで止める", async () => {
  const dir = await makeDir();
  const taken = await acquireTaskLock({ dir, taskPath: TASK, pid: 100, isProcessAlive: alive });
  await taken.release();
  await writeFile(taken.path, "壊れた中身", "utf8");

  await assert.rejects(
    () => acquireTaskLock({ dir, taskPath: TASK, pid: 200, isProcessAlive: dead }),
    /読めません/,
  );
});

test("回収されたあとの解放は、取り直したロックを消さない", async () => {
  const dir = await makeDir();
  const crashed = await acquireTaskLock({ dir, taskPath: TASK, pid: 100, isProcessAlive: alive });
  const reclaimed = await acquireTaskLock({
    dir,
    taskPath: TASK,
    pid: 200,
    isProcessAlive: dead,
  });

  await crashed.release();

  const state = await readTaskLock(reclaimed.path);
  assert.equal(state.kind, "held");
  assert.equal(state.kind === "held" ? state.lock.pid : null, 200);
});

test("ロックに依頼文を書かない", async () => {
  const dir = await makeDir();
  const lock = await acquireTaskLock({
    dir,
    taskPath: TASK,
    pid: 100,
    now: () => new Date("2026-09-01T00:00:00.000Z"),
    isProcessAlive: alive,
  });

  assert.deepEqual(JSON.parse(await readFile(lock.path, "utf8")), {
    taskPath: TASK,
    pid: 100,
    acquiredAt: "2026-09-01T00:00:00.000Z",
  });
});
