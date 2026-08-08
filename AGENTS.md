# Vatesteed

競馬予想AIエージェント。目的は「回収率を売る」ことではなく、**競馬に詳しい人間が予想時に
働かせている思考プロセスそのものをエージェントで再現する**こと。着順・タイム・人気は結果で
あって能力や状態そのものではない、という前提に立ち、数字の背後にある文脈・経緯・事情を
読み取って評価を補正する過程を構造化して再現する。

設計の背景・思想・個別の決定は `docs/` を参照すること。索引は
[docs/README.md](docs/README.md)。目的と思想は [docs/concept.md](docs/concept.md)、
構成は [docs/architecture.md](docs/architecture.md) にある。

**`docs/` には未確定事項が多く残っている。** 「未確定」と書かれているものを勝手に
確定させないこと。判断が必要になったら止まって確認する。列挙されたリストは、断りが
ない限り例示であって網羅ではない。

## 開発フェーズ

現在は **Phase 1**。

| Phase | 内容 |
| --- | --- |
| 1 | Claude Code をインタラクティブに使う。eve ランタイムは起動しない |
| 2 | Claude Code の Routines でスケジュール実行 |
| 3 | eve ランタイム導入。eval による回帰テスト |

Phase 1 では eve ランタイムを起動しない。Claude Code が `lib/` を直接呼ぶ。

## コードの置き場所

| パス | 役割 |
| --- | --- |
| `lib/` | ツールの実体ロジックとDBアクセス。エージェントと Next.js の両方から使う |
| `agent/tools/` | `lib/` を呼ぶ薄いラッパー。ロジックはここに書かない |
| `agent/skills/` | スキル。eve の `SKILL.md` 規約に従う |
| `agent/instructions.md` | 常時読み込みの指示。短く安定した内容だけを置く |
| `app/` | Next.js のダッシュボード |
| `docs/` | 設計ドキュメント |

**ロジックは必ず `lib/` に書く。** `agent/tools/` を薄いラッパーに保つことで、Phase 3 で
eve に載せる際にラッパーを書くだけで移行できる。

長い手順や状況依存の手順は `agent/instructions.md` ではなく `agent/skills/` に置く。
instructions は毎ターン読まれるため、恒久的な identity と standing rule だけに保つ。

## eve フレームワーク

コードを書く前に、インストール済みの eve パッケージの該当ガイドを読むこと。通常は
`node_modules/eve/docs/` にある。ワークスペースやローカルインストールの場合は、まず
インストール済み `eve` パッケージの場所を解決してその `docs/` を読む。パッケージの
ドキュメントが参照できない場合は https://eve.dev/docs をフォールバックとして使う。

統合を自分で実装する前に、`eve registry search <query>` または `eve registry list` で
利用可能な統合を探すこと。`eve registry view <item>` で中身を確認し、`eve add <item>`
で導入する。

eve は beta のため、バージョンは `package.json` で完全固定している（レンジ指定にしない）。

## 環境

- パッケージマネージャは **pnpm**。npm は使わない
- node / pnpm のバージョンは mise で管理している
- pnpm の設定（overrides・allowBuilds など）は `package.json` ではなく
  `pnpm-workspace.yaml` に書く。pnpm 11 は `package.json` の `pnpm` フィールドを読まない

## データの扱い

- 情報源から自動で本文を取り込むのではなく、**自分の目で見て、自分の言葉で要約・評価した
  内容をナレッジに登録する**のが原則
- 自動アクセスを禁止するドメインのリストを持つ。リストにあるドメインへエージェントから
  アクセスしない。**リストはまだ空のため、現時点では自動収集を行わない**
- JRA-VAN は商用利用不可

詳細は [docs/compliance.md](docs/compliance.md) を参照。
