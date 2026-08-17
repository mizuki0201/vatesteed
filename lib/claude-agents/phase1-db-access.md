## Phase 1 で DB を読み書きする

**この節は Claude Code 向けの生成のときに足されている。** 正本は
`lib/claude-agents/phase1-db-access.md` で、役の `instructions.md` には書かれていない。

SQL は `pnpm db:query` で投げる。

- 読む: `pnpm db:query "SELECT ... WHERE id = $1" --params '[1]'`
- 書く: 長い日本語の本文や引用符はシェルで壊れるので、SQL を `tmp/` の下のファイルに書いて
  `pnpm db:query --file tmp/<名前>.sql --params '[...]'` の形にする。**書き終わったらその
  ファイルを消す**（評価の本文を含む .sql をリポジトリに残さないため）
- **値は必ず `--params` で渡す。** SQL の中に文字列を直接埋め込まない
- **1回に投げられるのは1文だけ。** HTTP 経由の接続なので複数の文をまとめて流せない。
  ファイルに複数の文を並べない
- **テーブルの形や権限を変える文（`CREATE` `ALTER` `DROP` など）は入口が弾く。** スキーマを
  変える必要に気づいたら、自分で流さずオーケストレーターへ返す（変更は `db/migrations/` に
  置いて `pnpm db:migrate`）
- テーブルと列は `db/schema.sql` を読んで確かめる。列名を推測で書かない

### 書いてよいのは自分の担当の評価だけ

**`horse_notes`（馬の総合評価）は AI と人間の対話で作ると決まっている。** 役は書かず、
見立てをオーケストレーターへ返す。担当外の評価も同じで、自分に割り当てられた評価だけを書く。

**騎手と陣営のコメント（`entry_comments`）は読むだけ。** 履歴のテーブルなので、役が入れると
同じ発言が呼ばれた回数だけ積み上がる。登録はオーケストレーターの担当。

```sql
SELECT race_phase, speaker_role, speaker_name, spoken_on, summary, interpretation
FROM entry_comments WHERE entry_id = $1 ORDER BY spoken_on, id;
```

**入っているのは「誰が何を述べたか」であって、それが本当かどうかではない。** 表明された意図を
事実として扱わない。

### 評価（`*_notes`）を書くときは、この形だけを使う

```sql
INSERT INTO entry_notes (entry_id, body, author) VALUES ($1, $2, 'AI')
ON CONFLICT (entry_id) DO UPDATE SET body = EXCLUDED.body, author = 'AI'
WHERE entry_notes.author = 'AI'
RETURNING id;
```

テーブル名と対象の id 列は、自分の担当の評価に置き換える。`pedigree_notes` の `scope` の
ように列が増えるものは、`VALUES` と `ON CONFLICT ... DO UPDATE SET` の両方に足す。そのときも
**`WHERE <テーブル名>.author = 'AI'` は必ず付ける。**

### 0行が返ってきたら、上書きせずに返す

出力の `rowCount` が 0 なら、その行は人間か対話が書いたもので、上書きされずに残っている。
**書き直そうとしない。**

まず今の中身を読む。

```sql
SELECT body, author FROM entry_notes WHERE entry_id = $1;
```

そのうえで、**残っている見方・自分の新しい見方・何がどう変わるのか**を添えてオーケストレーター
へ返す。合意が取れてから書く。
