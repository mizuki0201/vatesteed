import { writeFile } from "node:fs/promises";
import type { Client } from "pg";

/**
 * 今DBにあるスキーマを1枚の .sql に書き出す。
 *
 * マイグレーションが増えると、あるテーブルの「今の形」を知るのに 0001 と 0007 と 0012 を
 * 突き合わせる必要が出てくる。それを毎回やらずに済むよう、`pnpm db:migrate` の最後に
 * 現在の姿を丸ごと吐いて、git に載せる。Rails の schema.rb と同じ考え方。
 *
 * **このファイルは読むためのもので、スキーマの変更経路ではない。** 変更は今まで通り
 * `db/migrations/` に .sql を足して流す。
 *
 * `pg_dump` は使わない。入っていない環境があると生成できなくなるため、カタログを引いて
 * 自分で組み立てる。組み立て部分（`renderSchema`）は純粋な関数にして単体テストを当てている。
 */

/** serial に畳める列の型と、畳んだ後の型。 */
const SERIAL_TYPES = new Map([
  ["smallint", "smallserial"],
  ["integer", "serial"],
  ["bigint", "bigserial"],
]);

/** CREATE TABLE の中に並べる制約を、読みやすい順に並べるための重み。 */
const INLINE_CONSTRAINT_ORDER = ["p", "u", "c"] as const;

const RULE = `-- ${"-".repeat(75)}`;

export type ColumnInfo = {
  name: string;
  /** `format_type()` が返すそのままの型名。 */
  type: string;
  notNull: boolean;
  /** `DEFAULT` の式。無ければ null。生成列ではその式が入る */
  defaultExpr: string | null;
  /** `pg_attribute.attidentity`。'a' = ALWAYS / 'd' = BY DEFAULT / '' = 通常の列 */
  identity: string;
  /** `pg_attribute.attgenerated`。's' = STORED / '' = 通常の列 */
  generated: string;
  /** その列が所有する連番シーケンスがあるか。bigserial などの判定に使う */
  ownsSequence: boolean;
};

export type ConstraintInfo = {
  name: string;
  /** `pg_constraint.contype`。'p' / 'u' / 'c' / 'f' */
  type: string;
  /** `pg_get_constraintdef()` が返す定義本体。 */
  definition: string;
};

export type TableInfo = {
  name: string;
  columns: ColumnInfo[];
  /** 外部キー以外の制約。CREATE TABLE の中に並べる */
  constraints: ConstraintInfo[];
};

export type SchemaInfo = {
  /** `schema_migrations` に入っているファイル名。どこまで流した状態かを頭に書くため */
  appliedMigrations: string[];
  /** `pg_get_functiondef()` の結果。 */
  functions: string[];
  tables: TableInfo[];
  /** 外部キーだけは、テーブルの並び順に依存しないよう最後にまとめて足す */
  foreignKeys: { table: string; constraint: ConstraintInfo }[];
  /** 制約に付いてこないインデックスの `pg_get_indexdef()`。 */
  indexes: string[];
  /** `pg_get_triggerdef()` の結果。 */
  triggers: string[];
};

/** 1列分を CREATE TABLE の中の1行にする。 */
function renderColumn(column: ColumnInfo, nameWidth: number, typeWidth: number): string {
  const serialType = column.ownsSequence ? SERIAL_TYPES.get(column.type) : undefined;
  const type = serialType ?? column.type;
  const modifiers: string[] = [];

  if (column.generated === "s") {
    // 生成列。値は式から決まるので DEFAULT は付かない
    modifiers.push(`GENERATED ALWAYS AS (${column.defaultExpr}) STORED`);
  } else if (column.identity === "a" || column.identity === "d") {
    modifiers.push(`GENERATED ${column.identity === "a" ? "ALWAYS" : "BY DEFAULT"} AS IDENTITY`);
  } else if (column.defaultExpr !== null && serialType === undefined) {
    // serial に畳んだ列の nextval() は型名に含まれているので出さない
    modifiers.push(`DEFAULT ${column.defaultExpr}`);
  }

  if (column.notNull) {
    modifiers.unshift("NOT NULL");
  }

  const name = column.name.padEnd(nameWidth);

  if (modifiers.length === 0) {
    return `  ${name} ${type}`;
  }
  return `  ${name} ${type.padEnd(typeWidth)} ${modifiers.join(" ")}`;
}

/** CREATE TABLE の中に並べる制約を、主キー → 一意 → CHECK の順にする。 */
function sortInlineConstraints(constraints: ConstraintInfo[]): ConstraintInfo[] {
  return [...constraints].sort((a, b) => {
    const rankA = INLINE_CONSTRAINT_ORDER.indexOf(a.type as (typeof INLINE_CONSTRAINT_ORDER)[number]);
    const rankB = INLINE_CONSTRAINT_ORDER.indexOf(b.type as (typeof INLINE_CONSTRAINT_ORDER)[number]);

    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return a.name.localeCompare(b.name);
  });
}

function renderTable(table: TableInfo): string {
  const nameWidth = Math.max(...table.columns.map((column) => column.name.length));
  const typeWidth = Math.max(
    ...table.columns.map((column) => {
      const serialType = column.ownsSequence ? SERIAL_TYPES.get(column.type) : undefined;
      return (serialType ?? column.type).length;
    }),
  );

  const lines = table.columns.map((column) => renderColumn(column, nameWidth, typeWidth));

  for (const constraint of sortInlineConstraints(table.constraints)) {
    lines.push(`  CONSTRAINT ${constraint.name} ${constraint.definition}`);
  }

  return `CREATE TABLE ${table.name} (\n${lines.join(",\n")}\n);`;
}

function sectionHeader(title: string): string {
  return `${RULE}\n-- ${title}\n${RULE}`;
}

/**
 * スキーマの中身を1枚の .sql の文字列にする。
 *
 * 外部キーだけ最後にまとめるのは、テーブルを名前順に並べたときに参照先がまだ無い、という
 * 状態を避けるため。上から順に流せる並びを狙っているが、空のDBへ流して確かめてはいない。
 * **スキーマを作る経路はあくまで `db/migrations/`** で、このファイルはその代わりではない。
 */
export function renderSchema(info: SchemaInfo): string {
  const header = [
    "-- このファイルは `pnpm db:migrate` が自動生成する。手で編集しない。",
    "-- スキーマを変えるときは db/migrations/ に新しい .sql を足して流す。",
    "--",
    "-- 今DBにあるテーブルの姿をそのまま写したもので、読むためのファイル。",
    "--",
    info.appliedMigrations.length === 0
      ? "-- 適用済みマイグレーション: なし"
      : `-- 適用済みマイグレーション:\n${info.appliedMigrations.map((name) => `--   ${name}`).join("\n")}`,
  ].join("\n");

  // 中身が無い区分は見出しごと出さない
  const parts = [header];

  if (info.functions.length > 0) {
    parts.push(
      sectionHeader("関数"),
      info.functions.map((definition) => `${definition.trimEnd()};`).join("\n\n"),
    );
  }

  if (info.tables.length > 0) {
    parts.push(sectionHeader("テーブル"), info.tables.map(renderTable).join("\n\n"));
  }

  if (info.foreignKeys.length > 0) {
    parts.push(
      sectionHeader("外部キー"),
      info.foreignKeys
        .map(
          ({ table, constraint }) =>
            `ALTER TABLE ${table} ADD CONSTRAINT ${constraint.name} ${constraint.definition};`,
        )
        .join("\n"),
    );
  }

  if (info.indexes.length > 0) {
    parts.push(
      sectionHeader("インデックス"),
      info.indexes.map((definition) => `${definition};`).join("\n"),
    );
  }

  if (info.triggers.length > 0) {
    parts.push(
      sectionHeader("トリガー"),
      info.triggers.map((definition) => `${definition};`).join("\n"),
    );
  }

  return `${parts.join("\n\n")}\n`;
}

/** 今つながっているDBからスキーマを読み取る。 */
export async function fetchSchema(client: Client): Promise<SchemaInfo> {
  // schema_migrations はマイグレーションではなく実行の記録なので、写す対象から外す。
  // どこまで流したかは頭のコメントに出す
  const excluded = "schema_migrations";

  const { rows: migrations } = await client.query<{ filename: string }>(
    "SELECT filename FROM schema_migrations ORDER BY filename",
  );

  const { rows: functions } = await client.query<{ definition: string }>(
    `SELECT pg_get_functiondef(p.oid) AS definition
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prokind = 'f'
      ORDER BY p.proname`,
  );

  const { rows: columns } = await client.query<{
    table_name: string;
    name: string;
    type: string;
    not_null: boolean;
    default_expr: string | null;
    identity: string;
    generated: string;
    owns_sequence: boolean;
  }>(
    `SELECT c.relname AS table_name,
            a.attname AS name,
            format_type(a.atttypid, a.atttypmod) AS type,
            a.attnotnull AS not_null,
            pg_get_expr(d.adbin, d.adrelid) AS default_expr,
            a.attidentity AS identity,
            a.attgenerated AS generated,
            pg_get_serial_sequence(c.oid::regclass::text, a.attname) IS NOT NULL AS owns_sequence
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname <> $1
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY c.relname, a.attnum`,
    [excluded],
  );

  const { rows: constraints } = await client.query<{
    table_name: string;
    name: string;
    type: string;
    definition: string;
  }>(
    `SELECT c.relname AS table_name,
            k.conname AS name,
            k.contype::text AS type,
            pg_get_constraintdef(k.oid) AS definition
       FROM pg_constraint k
       JOIN pg_class c ON c.oid = k.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname <> $1
        AND k.contype IN ('p', 'u', 'c', 'f')
      ORDER BY c.relname, k.conname`,
    [excluded],
  );

  const { rows: indexes } = await client.query<{ definition: string }>(
    `SELECT pg_get_indexdef(i.oid) AS definition
       FROM pg_index x
       JOIN pg_class c ON c.oid = x.indrelid
       JOIN pg_class i ON i.oid = x.indexrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname <> $1
        AND NOT EXISTS (
          SELECT 1 FROM pg_constraint k
           WHERE k.conindid = i.oid AND k.contype IN ('p', 'u', 'x')
        )
      ORDER BY c.relname, i.relname`,
    [excluded],
  );

  const { rows: triggers } = await client.query<{ definition: string }>(
    `SELECT pg_get_triggerdef(t.oid) AS definition
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname <> $1 AND NOT t.tgisinternal
      ORDER BY c.relname, t.tgname`,
    [excluded],
  );

  const tables = new Map<string, TableInfo>();

  for (const row of columns) {
    let table = tables.get(row.table_name);

    if (table === undefined) {
      table = { name: row.table_name, columns: [], constraints: [] };
      tables.set(row.table_name, table);
    }

    table.columns.push({
      name: row.name,
      type: row.type,
      notNull: row.not_null,
      defaultExpr: row.default_expr,
      identity: row.identity,
      generated: row.generated,
      ownsSequence: row.owns_sequence,
    });
  }

  const foreignKeys: SchemaInfo["foreignKeys"] = [];

  for (const row of constraints) {
    const constraint = { name: row.name, type: row.type, definition: row.definition };

    if (row.type === "f") {
      foreignKeys.push({ table: row.table_name, constraint });
      continue;
    }
    tables.get(row.table_name)?.constraints.push(constraint);
  }

  return {
    appliedMigrations: migrations.map((row) => row.filename),
    functions: functions.map((row) => row.definition),
    tables: [...tables.values()],
    foreignKeys,
    indexes: indexes.map((row) => row.definition),
    triggers: triggers.map((row) => row.definition),
  };
}

/** スキーマを読み取って .sql に書き出す。書いた先とテーブル数を返す。 */
export async function writeSchemaSnapshot(
  client: Client,
  filePath: string,
): Promise<{ filePath: string; tableCount: number }> {
  const info = await fetchSchema(client);
  await writeFile(filePath, renderSchema(info), "utf8");

  return { filePath, tableCount: info.tables.length };
}
