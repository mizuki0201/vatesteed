# Codex から Claude Code を呼ぶ

Phase 1 では、Codex が人との対話と進行を担い、Claude Code が実行を担う。ここでは、Codex から
このリポジトリの Claude Code を呼ぶ方法を定める。

**本人から実行元について明示の指示が無い限り、これが既定の体制である。** 競馬について対話する
依頼では Claude Code が登録・分析・予想・振り返りを実行し、Vatesteed 自体を作る依頼では
Claude Code を `dev-implementer` の実行元として使う（開発時の配置は
[development.md の「開発時の実行方法（暫定）」](development.md#開発時の実行方法暫定)が正本）。
Codex は変更の規模や単純さを理由にこの既定を省かない。本人が Codex 単体などを明示したときは、
その指示が優先される。この配置は現在試している運用であり、変えるときはこの文書と
[development.md](development.md) を先に更新する。

## モデル

Claude Code の呼び出しは必ず Opus を使う。直接 `claude -p` を実行せず、リポジトリの入口だけを使う。

```sh
pnpm claude:opus -- --task docs/tasks/<タスク名>.md
```

この入口は `claude -p --model opus --output-format stream-json` に加えて、子エージェントを禁じる
`--disallowedTools Agent` を渡す。依頼文をコマンドへ直接渡さず、検証済みのタスクMarkdownだけを
渡す。既定モデルへのフォールバックはしない。結果の `modelUsage` に `claude-opus-5` が無ければ
失敗として扱い、別のモデルで続行しない。

Claude Code の役定義もすべて `anthropic/claude-opus-5` に固定する。`pnpm gen:agents` は別のモデルやモデル未指定の役を生成しない。

## 実行の単位と再開

1つの依頼は `docs/tasks/` の1つのMarkdownとして保存し、1つのClaude Codeセッションで
完了させる。開発と競馬の分析を同じファイルへ混ぜない。両方を含む依頼は2つのタスクへ分け、
「参照」に依存関係を書く。

タスクMarkdownのfrontmatterには `mode` と `executor_role` を必須で持たせる。

```yaml
mode: development # または racing
executor_role: dev-implementer # racingではentry-analystなど
```

`development` では開発用の必須項目と `dev-` で始まる役を、`racing` では競馬用の必須項目と
分析する役を検証する。`mode` が無い、値が不正、役がモードと合わない、必須項目が足りない場合は
Claude Codeを起動しない。

- 新規実行は `pnpm claude:opus -- --task docs/tasks/<タスク名>.md` を使う
- 中断・利用枠エラー・検証不合格になった後は、
  `pnpm claude:opus -- --resume <実行記録のID> --task docs/tasks/<タスク名>.md` で同じセッションを再開する
- 実行記録が正常完了を示していない限り、新規実行で同じ依頼をやり直さない。最初からやり直すのは、
  本人が明示したときだけ `pnpm claude:opus -- --restart --task docs/tasks/<タスク名>.md` で行う
- 小さな確認や進捗確認だけを理由にClaude Codeを呼ばない。CodexがタスクMarkdown、実行記録、
  DBまたはコード差分を読む

Claude Codeを起動する前に、実行記録を `running` として `.claude/runs/` へ保存する。Claude Codeが
ストリーム出力へ `session_id` を返した時点で同じ実行記録へ追記する。呼び出し側が途中で終了しても、
取得済みのセッションIDを失わないようにする。

タスクMarkdownには作業単位ごとに、完了したこと、現在の作業、次の作業、問題点を記録する。
検索やツール呼び出しのたびには更新しない。競馬の分析でDBを更新するときは、DBへ保存し、DBを
読み直して確認し、その結果をMarkdownへ記載してから次へ進む。再開時はMarkdownだけを信用せず、
DBまたはコード差分と照合する。

入口は、モデルの終了コードだけを成功と見なさない。JSONの最終結果、`claude-opus-5` の使用、
終了理由、子エージェント数を検証し、どれかが欠ければ未完了として実行記録に残す。標準出力が空、
利用枠エラー、JSONとして読めない出力も未完了であり、成功として次へ進まない。

**既定では子エージェントを起動しない。** 1つの分析単位に必要な文脈が共有される作業は、同じ
Claude Code セッションで処理する。現在の入口は子エージェントを禁止している。将来例外を設ける
なら、依頼の実行契約、実行数の物理的な上限、完了判定を先に実装する。ツール呼び出しの同時数も2を
超えないようにする。

根拠のない固定往復数では終了させない。完了条件を満たしたとき、本人にしか決められない事項が
発生したとき、アクセス拒否などで継続できないとき、同じ失敗を繰り返して進展しないとき、
DB保存またはMarkdown更新を確認できないときに終了する。終了理由と再開条件はMarkdownへ残す。

## 保存先の役割

| 保存先 | 保存するもの |
| --- | --- |
| DB | 馬、出走、血統、分析など競馬に関する成果物 |
| `docs/tasks/<タスク名>.md` | 依頼、完了条件、調査結果の要約、現在地、次の作業、問題点、保存確認 |
| `.claude/runs/<実行記録のID>.json` | Claude CodeのセッションID、実行状態、モード、役、タスクファイルのパス |

分析専用の実行状態JSONは持たない。競馬の成果物はDBを基準にし、Markdownに完了と書かれていても
DBで確認できなければ未完了として扱う。取得したページ本文は保存せず、必要な要約と参照元だけを
MarkdownとDBへ残す。

## 認証

認証はこのリポジトリだけに置く。`~/.codex/.env`、API キー、Keychain の操作は使わない。

`.claude/settings.local.json` に、次だけを置く。

```json
{
  "env": {
    "CLAUDE_CODE_OAUTH_TOKEN": "claude setup-token で作成したトークン"
  }
}
```

このファイルは gitignore 済みで、トークンは Claude のサブスクリプション認証にだけ使う。値を会話、ログ、コミット、共有設定へ出してはならない。Codex は存在・形式・実際の接続結果だけを確認し、トークンの値を読んだり書き換えたりしない。

## 新しい Codex タスクでの接続確認

既定の体制で進める新しい Codex タスクでは、docs やコードを変更する前に、ファイル操作をしない
最小呼び出しを1回行う。接続確認は本来の依頼の前段であって、依頼の一部を先に実装してから行う
ものではない。

```sh
pnpm claude:opus -- --check-auth
```

Codex の実行環境では Anthropic API へのネットワーク接続を許可して実行する。`AUTH_OK` と `claude-opus-5` を確認できたら、そのタスクで本来の依頼を実行してよい。確認できないうちは docs もコードも変更しない。`claude auth status` はこのプロジェクトのローカル設定を使った実行可否の確認には使わない。

## 失敗時

- `ENOTFOUND` や API に接続できないエラーは、認証をやり直す前にネットワーク接続の許可を確認する。Keychain の再登録やトークンの作り直しはしない。
- OAuth の拒否が返ったときだけ、トークンの期限・失効を本人へ伝える。値は表示しない。
- Opus 以外のモデルが返った場合は続行しない。モデルを自動で切り替えない。

この手順の実接続確認は、2026-08-25 に `claude-opus-5` で成功している。
