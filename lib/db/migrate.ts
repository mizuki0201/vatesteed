import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Client } from "pg";

/**
 * `db/migrations/` の未適用の .sql を番号順に流す。
 *
 * - 1ファイル = 1トランザクション。途中で落ちたらそのファイルは丸ごと戻る
 * - 適用済みのファイル名は `schema_migrations` に記録し、二度流さない
 * - 接続は `DATABASE_URL_UNPOOLED`。実行時に使う HTTP 経由のドライバは
 *   複数の文をまたぐトランザクションを張れないため、ここだけ直結する
 *
 * 実行は人間が手で `pnpm db:migrate`。Vercel のビルドからは流さない
 * （デプロイのたびに本番DBへ走ってしまうため）。
 */

const MIGRATIONS_DIR = fileURLToPath(new URL("../../db/migrations", import.meta.url));

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED;

  if (!url) {
    throw new Error(
      [
        "DATABASE_URL_UNPOOLED が設定されていません。",
        "本番へ流す場合: `pnpm vercel env pull .env.local`",
        "検証ブランチへ流す場合: .env.migration-test に migration-test ブランチの接続文字列を",
        "DATABASE_URL_UNPOOLED= の形で1行書く",
      ].join("\n"),
    );
  }

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  const client = new Client({ connectionString: withStrictSsl(url) });
  await client.connect();

  // どこへ流すかは毎回目で確かめる。本番と検証ブランチはホスト名で見分けられる
  console.log(`接続先: ${hostOf(url)}`);

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename    text PRIMARY KEY,
        applied_at  timestamptz NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query<{ filename: string }>(
      "SELECT filename FROM schema_migrations",
    );
    const applied = new Set(rows.map((row) => row.filename));
    const pending = files.filter((name) => !applied.has(name));

    if (pending.length === 0) {
      console.log("未適用のマイグレーションはありません。");
      await reportTables(client);
      return;
    }

    console.log(`未適用: ${pending.join(", ")}`);

    for (const filename of pending) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, filename), "utf8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`${filename} の適用に失敗しました。変更は戻してあります。`, {
          cause: error,
        });
      }

      console.log(`適用: ${filename}`);
    }

    await reportTables(client);
  } finally {
    await client.end();
  }
}

/** 今そのDBに何テーブルあるかを出す。流した結果を目で確かめるため。 */
async function reportTables(client: Client) {
  const { rows } = await client.query<{ name: string }>(`
    SELECT table_name AS name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  // schema_migrations は運用用なので数から外す
  const tables = rows.map((row) => row.name).filter((name) => name !== "schema_migrations");

  console.log(`\nテーブル ${tables.length} 個:`);
  console.log(tables.join(" "));
}

/**
 * `sslmode` を `verify-full` に固定する。
 *
 * pg は今のところ `require` などを `verify-full` と同じ強さで扱っているが、次のメジャーで
 * libpq 準拠の弱い意味に変わる予告が出ている（実行するたびに警告が出るのはこれ）。
 * 今と同じ強さのまま黙らせるため、明示的に書いておく。
 */
function withStrictSsl(url: string): string {
  try {
    const parsed = new URL(url);
    const mode = parsed.searchParams.get("sslmode");

    if (mode !== null && ["prefer", "require", "verify-ca"].includes(mode)) {
      parsed.searchParams.set("sslmode", "verify-full");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/** どのホストに流したかをログに残す。パスワードは出さない。 */
function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "(解釈できない接続文字列)";
  }
}

await main();
