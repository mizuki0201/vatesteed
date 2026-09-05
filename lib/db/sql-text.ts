/**
 * SQL の文字列を、`pnpm db:query` の入口で判定するために読み解く。
 *
 * スキーマを変える文かどうか（`query.ts`）と、競馬モードで更新してよい先かどうか
 * （`racing-mode.ts`）の両方がここを通る。
 *
 * **構文解析ではない。** 役はシェルを叩けるので、細工されたSQLまでは止められない。
 * 意図した回避ではなく事故を止めるためのものなので、判定は素直な形にしてある。
 */

/**
 * コメントと文字列リテラルを取り除く。
 *
 * 本文や説明の中にある `UPDATE` のような言葉を、実行される文と取り違えないようにする。
 * **二重引用符は残す。** Postgres では文字列ではなく識別子なので、更新先のテーブル名を
 * 読み取るのに要る。
 */
export function stripSqlNoise(sqlText: string): string {
  let stripped = "";
  let index = 0;

  while (index < sqlText.length) {
    if (sqlText.startsWith("--", index)) {
      const lineEnd = sqlText.indexOf("\n", index);
      // 閉じる改行が無ければ、この先はすべてコメント
      if (lineEnd === -1) break;
      index = lineEnd;
      continue;
    }

    if (sqlText.startsWith("/*", index)) {
      // 前後の言葉がつながらないように、空白1つへ置き換える
      stripped += " ";
      const end = blockCommentEnd(sqlText, index);
      if (end === -1) break;
      index = end;
      continue;
    }

    if (sqlText[index] === "'") {
      stripped += "''";
      const end = quotedStringEnd(sqlText, index);
      if (end === -1) break;
      index = end;
      continue;
    }

    const tag = dollarQuoteTag(sqlText, index);
    if (tag !== null) {
      stripped += " ";
      const end = sqlText.indexOf(tag, index + tag.length);
      if (end === -1) break;
      index = end + tag.length;
      continue;
    }

    stripped += sqlText[index];
    index++;
  }

  return stripped;
}

/** SQL の先頭のキーワードを大文字で返す。見つからなければ undefined。 */
export function leadingKeyword(sqlText: string): string | undefined {
  const head = stripSqlNoise(sqlText).trimStart().match(/^[A-Za-z]+/);
  return head?.[0].toUpperCase();
}

/** ブロックコメントの終わりの位置を返す。Postgres のブロックコメントは入れ子にできる。 */
function blockCommentEnd(sqlText: string, start: number): number {
  let depth = 0;
  let index = start;

  while (index < sqlText.length) {
    if (sqlText.startsWith("/*", index)) {
      depth++;
      index += 2;
    } else if (sqlText.startsWith("*/", index)) {
      depth--;
      index += 2;
      if (depth === 0) return index;
    } else {
      index++;
    }
  }

  // 閉じていないコメント
  return -1;
}

/** 単引用符の文字列の終わりの位置を返す。`''` は文字列の中の引用符1つ。 */
function quotedStringEnd(sqlText: string, start: number): number {
  let index = start + 1;

  while (index < sqlText.length) {
    if (sqlText[index] !== "'") {
      index++;
      continue;
    }
    if (sqlText[index + 1] === "'") {
      index += 2;
      continue;
    }
    return index + 1;
  }

  // 閉じていない文字列
  return -1;
}

/** その位置から始まるドル引用符の目印（`$$` や `$tag$`）を返す。無ければ null。 */
function dollarQuoteTag(sqlText: string, index: number): string | null {
  const tag = sqlText.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/);
  return tag?.[0] ?? null;
}
