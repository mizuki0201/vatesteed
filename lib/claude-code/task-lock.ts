/**
 * タスク単位のロック。
 *
 * 同じタスクMarkdownに対する Claude Code の実行を、同時に1つだけにする
 * （docs/claude-code-bridge.md の「実行の単位と再開」）。実行記録を読んでから `running` を
 * 保存するまでの間に別の入口が割り込むと、同じタスクの実行が2つ動く。**確認と保存を並べる
 * だけでは競合が残るので、ロックの取得を先に行う。**
 *
 * ロックファイルの作成は `link` で行う。同じ名前が既にあれば失敗するので、2つの入口が同時に
 * 取りに来ても片方しか成功しない。
 */

import { createHash, randomBytes } from "node:crypto";
import { link, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/** ロックファイルの中身。**依頼文や認証情報は書かない。** */
export type TaskLockFile = {
  taskPath: string;
  /** ロックを取った入口のプロセスID。異常終了したかどうかの判定に使う */
  pid: number;
  acquiredAt: string;
};

export type TaskLockState =
  | { kind: "missing" }
  | { kind: "broken" }
  | { kind: "held"; lock: TaskLockFile };

export type TaskLock = {
  path: string;
  lock: TaskLockFile;
  /** 異常終了で残っていたロックを回収したなら、そのプロセスID。回収していなければ null */
  reclaimedFrom: number | null;
  release: () => Promise<void>;
};

export type AcquireTaskLockOptions = {
  /** ロックファイルを置くディレクトリ */
  dir: string;
  taskPath: string;
  pid?: number;
  now?: () => Date;
  /** ロックの持ち主がまだ動いているかの確認。テストで差し込む */
  isProcessAlive?: (pid: number) => boolean;
};

/** 実行記録のディレクトリと並べて置く。実行記録を読む側がロックファイルを拾わないようにする。 */
export function taskLocksDir(runsDir: string): string {
  return `${runsDir}-locks`;
}

/** タスクMarkdownのパスから、ファイル名として使える名前を作る。 */
export function taskLockPath(dir: string, taskPath: string): string {
  const digest = createHash("sha256").update(taskPath).digest("hex").slice(0, 16);
  const readable = path
    .basename(taskPath, path.extname(taskPath))
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 40);

  return path.join(dir, `${readable}-${digest}.lock`);
}

function isTaskLockFile(value: unknown): value is TaskLockFile {
  if (typeof value !== "object" || value === null) return false;
  const source = value as Record<string, unknown>;

  return (
    typeof source.taskPath === "string" &&
    typeof source.pid === "number" &&
    Number.isInteger(source.pid) &&
    typeof source.acquiredAt === "string"
  );
}

/** ロックファイルを読む。無いのか、壊れているのか、持ち主がいるのかを分けて返す。 */
export async function readTaskLock(file: string): Promise<TaskLockState> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { kind: "missing" };
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: "broken" };
  }

  return isTaskLockFile(parsed) ? { kind: "held", lock: parsed } : { kind: "broken" };
}

/** シグナル0は届くかどうかだけを見る。EPERM は、いるが送れないという意味なので生きている。 */
function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** 既に同じ名前があれば作らずに false を返す。 */
async function createLockFile(file: string, content: TaskLockFile): Promise<boolean> {
  const temporary = `${file}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(temporary, `${JSON.stringify(content, null, 2)}\n`, "utf8");

  try {
    await link(temporary, file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    return false;
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

function sameLock(left: TaskLockFile, right: TaskLockFile): boolean {
  return left.pid === right.pid && left.acquiredAt === right.acquiredAt;
}

function makeLock(file: string, content: TaskLockFile, reclaimedFrom: number | null): TaskLock {
  return {
    path: file,
    lock: content,
    reclaimedFrom,
    release: async () => {
      const state = await readTaskLock(file);
      // 回収されて別の入口が取り直したロックは消さない。
      if (state.kind !== "held" || !sameLock(state.lock, content)) return;
      await unlink(file).catch(() => {});
    },
  };
}

/**
 * ロックを取る。**取れなければ例外にする。待って取り直さない。**
 *
 * 持ち主のプロセスが存在しないことを確認できたときだけ、残っていたロックを回収する。
 */
export async function acquireTaskLock({
  dir,
  taskPath,
  pid = process.pid,
  now = () => new Date(),
  isProcessAlive = processAlive,
}: AcquireTaskLockOptions): Promise<TaskLock> {
  await mkdir(dir, { recursive: true });

  const file = taskLockPath(dir, taskPath);
  const content: TaskLockFile = { taskPath, pid, acquiredAt: now().toISOString() };

  if (await createLockFile(file, content)) return makeLock(file, content, null);

  const state = await readTaskLock(file);
  if (state.kind === "broken") {
    throw new Error(
      `タスク ${taskPath} のロック ${file} が読めません。実行中のものが無いことを確かめてから消してください。`,
    );
  }
  if (state.kind === "held" && isProcessAlive(state.lock.pid)) {
    throw new Error(
      `タスク ${taskPath} は実行中です（プロセス ${state.lock.pid}、開始 ${state.lock.acquiredAt}）。終わるまで新規実行も再開もできません。`,
    );
  }

  const reclaimedFrom = state.kind === "held" ? state.lock.pid : null;
  if (state.kind === "held") await unlink(file).catch(() => {});

  if (await createLockFile(file, content)) return makeLock(file, content, reclaimedFrom);

  throw new Error(`タスク ${taskPath} のロックを別の入口が先に取りました。終わるまで待ってください。`);
}
