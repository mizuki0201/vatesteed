import { access, readFile } from "node:fs/promises";
import path from "node:path";

export type TaskMode = "development" | "racing";
export type TaskStatus = "todo" | "doing" | "blocked" | "done";

export type TaskContract = {
  readonly title: string;
  readonly area: string;
  readonly mode: TaskMode;
  readonly executorRole: string;
  readonly status: TaskStatus;
  readonly created: string;
  readonly updated: string;
  /** リポジトリからの相対パス。Claude Codeと実行記録へ渡す値。 */
  readonly taskPath: string;
  readonly body: string;
};

const COMMON_SECTIONS = [
  "なぜ",
  "依頼",
  "完了条件",
  "実行上の制約",
  "事前調査",
  "現在地",
  "問題点",
  "保存確認",
  "作業記録",
  "参照",
] as const;

const MODE_SECTIONS: Readonly<Record<TaskMode, readonly string[]>> = {
  development: [
    "正本となる設計",
    "実装範囲",
    "対象外",
    "変更結果",
    "テスト結果",
    "Codexの受け入れ結果",
  ],
  racing: ["分析対象", "対象ごとの進捗", "DBへの保存結果", "参照元", "未登録・未分析"],
};

function unquote(value: string): string {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseFrontmatter(source: string): { fields: Map<string, string>; body: string } {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (match === null) {
    throw new Error("タスクMarkdownにfrontmatterがありません。");
  }

  const fields = new Map<string, string>();
  for (const line of match[1].split(/\r?\n/)) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const field = line.match(/^([a-z_]+):\s*(.*?)\s*$/);
    if (field === null || field[2] === "") {
      throw new Error(`frontmatterを読めません: ${JSON.stringify(line)}`);
    }
    if (fields.has(field[1])) {
      throw new Error(`frontmatterの ${field[1]} が重複しています。`);
    }
    fields.set(field[1], unquote(field[2]));
  }

  return { fields, body: match[2] };
}

function required(fields: ReadonlyMap<string, string>, key: string): string {
  const value = fields.get(key);
  if (value === undefined || value.trim() === "") {
    throw new Error(`タスクMarkdownのfrontmatterに ${key} がありません。`);
  }
  return value;
}

function parseMode(value: string): TaskMode {
  if (value !== "development" && value !== "racing") {
    throw new Error("タスクMarkdownの mode は development または racing にしてください。");
  }
  return value;
}

function parseStatus(value: string): TaskStatus {
  if (value !== "todo" && value !== "doing" && value !== "blocked" && value !== "done") {
    throw new Error("タスクMarkdownの status が不正です。");
  }
  return value;
}

function sectionNames(body: string): Set<string> {
  return new Set(
    [...body.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1]),
  );
}

function assertSections(body: string, mode: TaskMode): void {
  const present = sectionNames(body);
  for (const section of [...COMMON_SECTIONS, ...MODE_SECTIONS[mode]]) {
    if (!present.has(section)) {
      throw new Error(`タスクMarkdownに「## ${section}」がありません。`);
    }
  }

  const otherMode: TaskMode = mode === "development" ? "racing" : "development";
  const mixedSection = MODE_SECTIONS[otherMode].find((section) => present.has(section));
  if (mixedSection !== undefined) {
    throw new Error(
      `1つのタスクMarkdownにdevelopmentとracingを混在させられません: 「## ${mixedSection}」`,
    );
  }

  const completion =
    body.match(/^##\s+完了条件\s*$([\s\S]*?)(?=^##\s+|(?![\s\S]))/m)?.[1] ?? "";
  if (!/^- \[(?: |x)\] /m.test(completion)) {
    throw new Error("タスクMarkdownの完了条件にチェックボックスがありません。");
  }
}

function assertRoleMatchesMode(mode: TaskMode, executorRole: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(executorRole)) {
    throw new Error("executor_roleの形式が不正です。");
  }
  if (executorRole === "codex") return;
  if (mode === "development" && !executorRole.startsWith("dev-")) {
    throw new Error("developmentのexecutor_roleはdev-で始まる開発役にしてください。");
  }
  if (mode === "racing" && executorRole.startsWith("dev-")) {
    throw new Error("racingのexecutor_roleに開発役は指定できません。");
  }
}

function taskPath(rootDir: string, requestedPath: string): {
  absolutePath: string;
  relativePath: string;
} {
  const taskRoot = path.resolve(rootDir, "docs/tasks");
  const absolutePath = path.resolve(rootDir, requestedPath);
  if (path.dirname(absolutePath) !== taskRoot || path.extname(absolutePath) !== ".md") {
    throw new Error("タスクMarkdownはdocs/tasks/直下の.mdファイルを指定してください。");
  }
  return { absolutePath, relativePath: path.relative(rootDir, absolutePath) };
}

/** タスクMarkdownを読み、Claude Codeへ渡す前提を検証する。 */
export async function loadTaskContract(
  rootDir: string,
  requestedPath: string,
): Promise<TaskContract> {
  const resolved = taskPath(rootDir, requestedPath);
  const source = await readFile(resolved.absolutePath, "utf8").catch(() => {
    throw new Error(`タスクMarkdownが見つかりません: ${resolved.relativePath}`);
  });
  const { fields, body } = parseFrontmatter(source);
  const mode = parseMode(required(fields, "mode"));
  const executorRole = required(fields, "executor_role");
  const status = parseStatus(required(fields, "status"));
  assertRoleMatchesMode(mode, executorRole);
  if (executorRole !== "codex") {
    const instructionPath = path.join(
      rootDir,
      "agent/subagents",
      executorRole,
      "instructions.md",
    );
    await access(instructionPath).catch(() => {
      throw new Error(`executor_roleの指示が見つかりません: ${executorRole}`);
    });
  }
  assertSections(body, mode);

  return {
    title: required(fields, "title"),
    area: required(fields, "area"),
    mode,
    executorRole,
    status,
    created: required(fields, "created"),
    updated: required(fields, "updated"),
    taskPath: resolved.relativePath,
    body,
  };
}

/** Claude Codeで実行してよいタスクかを確かめる。 */
export function assertClaudeExecutableTask(task: TaskContract): void {
  if (task.executorRole === "codex") {
    throw new Error("executor_roleがcodexのタスクはClaude Codeで実行できません。");
  }
  if (task.status === "todo") {
    throw new Error("Claude Codeを起動する前にタスクのstatusをdoingにしてください。");
  }
  if (task.status === "done") {
    throw new Error("完了済みのタスクはClaude Codeで実行できません。");
  }
}

/** タスクの本文を複製せず、Claude Codeへ読み方と更新規則だけを渡す。 */
export function buildTaskPrompt(task: TaskContract, resumed: boolean): string {
  const common = [
    `あなたは ${task.executorRole} として実行する。`,
    `agent/subagents/${task.executorRole}/instructions.md を全文読み、その役の指示に従う。`,
    `最初に ${task.taskPath} を全文読み、このファイルだけを依頼内容と進捗の記録として扱う。`,
    `modeは ${task.mode}。別のmodeの作業へ移らない。`,
    "再開時はMarkdownだけを信用せず、実際のDBまたはコード差分と照合して現在地を直してから続ける。",
    "検索やツール呼び出しのたびではなく、意味のある作業単位が完了するたびに「現在地」「保存確認」「作業記録」を更新する。",
    "完了条件を満たした場合、または継続できない問題が発生した場合は、現在地と理由を更新して終了する。",
    "status: doneはCodexが成果物を確認して受け入れた後に更新する。自分では変更しない。",
  ];

  if (task.mode === "development") {
    common.push(
      "コード変更とテストを行い、「変更結果」「テスト結果」を更新する。Codexの受け入れ結果はCodexだけが更新する。",
    );
  } else {
    common.push(
      "コードと設計docsは変更しない。競馬の情報はDBへ保存し、DBを読み直して確認してから「対象ごとの進捗」「DBへの保存結果」「現在地」を更新する。",
      "取得したページ本文は保存せず、必要な要約と参照元だけを残す。",
    );
  }

  if (resumed) {
    common.push("これは同じClaude Codeセッションの再開である。完了済みの作業を繰り返さず、未完了の次の作業から続ける。");
  }

  return common.join("\n");
}
