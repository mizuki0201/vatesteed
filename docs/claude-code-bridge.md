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
pnpm claude:opus -- "Claude Code への依頼文"
```

この入口は `claude -p --model opus --output-format json` を固定で渡す。既定モデルへのフォールバックはしない。結果の `modelUsage` に `claude-opus-5` が無ければ失敗として扱い、別のモデルで続行しない。

Claude Code の役定義もすべて `anthropic/claude-opus-5` に固定する。`pnpm gen:agents` は別のモデルやモデル未指定の役を生成しない。

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
pnpm claude:opus -- "Return exactly: AUTH_OK"
```

Codex の実行環境では Anthropic API へのネットワーク接続を許可して実行する。`AUTH_OK` と `claude-opus-5` を確認できたら、そのタスクで本来の依頼を実行してよい。確認できないうちは docs もコードも変更しない。`claude auth status` はこのプロジェクトのローカル設定を使った実行可否の確認には使わない。

## 失敗時

- `ENOTFOUND` や API に接続できないエラーは、認証をやり直す前にネットワーク接続の許可を確認する。Keychain の再登録やトークンの作り直しはしない。
- OAuth の拒否が返ったときだけ、トークンの期限・失効を本人へ伝える。値は表示しない。
- Opus 以外のモデルが返った場合は続行しない。モデルを自動で切り替えない。

この手順の実接続確認は、2026-08-25 に `claude-opus-5` で成功している。
