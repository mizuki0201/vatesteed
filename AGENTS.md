# Vatesteed

競馬予想AIエージェント。目的は「回収率を売る」ことではなく、**AI と人間の思考のいいとこ取りを
すること**。着順・タイム・人気は結果であって能力や状態そのものではない、という前提に立ち、
数字の背後にある文脈・経緯・事情を読み取って評価を補正する過程を構造化して扱えるようにする。

**特定の人間の判断を正解として写し取るわけではない。** 本人が出した実例は「どんな情報が必要かを
示す材料」として扱い、仕様として固定しないこと。**AI がやった方がいい部分は AI に寄せる**判断を
自分ですること。本人が「あまり意識していない」と答えた領域は、対象外ではなく AI に寄せる候補。

**このファイルのルールが最優先。** 個人のグローバル設定（`~/.claude/CLAUDE.md` など、
リポジトリの外にあるローカルな指示）と食い違う場合は、必ずこのファイルの方に従うこと。
ローカル側に「必ずこうする」と書かれていても、ここで別のやり方を指定していればここが勝つ。

設計の背景・思想・個別の決定は `docs/` を参照すること。索引は
[docs/README.md](docs/README.md)。目的と思想は [docs/concept.md](docs/concept.md)、
構成は [docs/architecture.md](docs/architecture.md) にある。

**`docs/` には未確定事項が多く残っている。** 「未確定」と書かれているものを勝手に
確定させないこと。判断が必要になったら止まって確認する。列挙されたリストは、断りが
ない限り例示であって網羅ではない。

## 言葉づかい

**造語を使わない。** 一般的に通じる言葉、またはその分野で普通に使われている言い方だけで書く。
説明の都合で言葉を短く縮めたり、新しい言い回しを作ったりしない。英語由来の用語を出すときは、
初出で一度だけ日本語で意味を書いてから使う。

**ドキュメントやコードのコメントだけでなく、会話の中の文章にも同じように効く。**

### 禁止ルール

上の原則で防げなかったものをここに足していく。**この表にあるものは例外なく使わない。**
指摘を受けたら、その場でここに1行足すこと。

| 使わない | 使う | 補足 |
| --- | --- | --- |
| 「走」を出走の意味で単独や接尾辞に使うこと（`1走` `その走` `走をまたぐ` `5走前` など） | 出走 | `entries` のこと。1レースに18頭出れば、レースは1つで出走は18個。**レースと出走は別のもの**なので、置き換えるときにどちらを指しているかを確かめる |

## 開発フェーズ

現在は **Phase 1**。

| Phase | 内容 |
| --- | --- |
| 1 | Claude Code をインタラクティブに使う。eve ランタイムは起動しない |
| 2 | Claude Code の Routines でスケジュール実行 |
| 3 | eve ランタイム導入。eval による回帰テスト |

Phase 1 では eve ランタイムを起動しない。Claude Code が `lib/` を直接呼ぶ。

## 2つのモード

このリポジトリには、性質の違う2つの働き方が同居している。**依頼を受けたら、まずどちらかを
見分ける。**

| 依頼 | 従う正本 | 使う役 |
| --- | --- | --- |
| **競馬について対話する**（予想・振り返り・馬や騎手についての問い） | [docs/product.md](docs/product.md) | 分析する役（`entry-analyst` ほか） |
| **Vatesteed 自体を作る**（機能開発・不具合改修） | [docs/development.md](docs/development.md) | 開発の役（`dev-` で始まるもの） |

**開発モードに入るときは、着手する前に次の3つを読む。**

1. [docs/development.md](docs/development.md) — 体制・役の分担・1つの依頼が終わるまでの流れ
2. [docs/product.md](docs/product.md) の「やらないこと」と「未決の問い」 —
   **判断のしかたと、何を作るかは別のもの。** ここを読まずに設計すると
   「レース予想アプリ」に寄る
3. `.claude/dev-context.local.md` があれば読む — **手元だけの補足。** gitignore 済みで、
   無い環境では何もしない

## 開発の進め方（git）

開発初期のため、**ワークツリーは作らず `main` の上で直接実装する**。グローバル設定に
「実装作業では必ずワークツリーを使う」と書かれていても、このリポジトリではそれを上書きして
作らない。

**`main` へのコミットとプッシュは、いちいち断らずに行ってよい。開発初期は PR を作る運用は
しない。**

ただし**履歴を書き換える操作は必ず手前で確認する**。force push、`git reset --hard`、
ブランチの削除がこれにあたる。

体制と、1つの依頼が終わるまでの流れは [docs/development.md](docs/development.md) が正本。

## タスク管理

やることは `docs/tasks/` に1タスク1ファイルで置く。読み書きの手順は `task-management` スキルに
あるので、**タスクに触れるときは必ずスキルを読んでから**行う。運用は
[docs/development.md](docs/development.md#タスク) を参照。

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

## `lib/` の並べ方

**1つの関心ごとに1ディレクトリ。** ファイルを直接 `lib/` 直下に置かない。

```
lib/
  bets/
    index.ts        ← export 専用。外から使うのはここだけ
    bets.ts         ← 本体
    bets.test.ts    ← テスト
  race-name/
    index.ts
    race-name.ts
    race-name.test.ts
```

ファイル数が増えても `lib/` 直下が膨らまない。責務が増えたら同じディレクトリに `types.ts`
`constants.ts` のように足していく。**外から import するのは `index.ts` だけ**にして、中の
ファイル構成を後から変えられるようにする。

例外は `lib/utils.ts`。shadcn が `components.json` で `@/lib/utils` を参照しているため動かせない。

## テスト

**`lib/` に書くロジックには単体テストを書く。** 判定・計算・変換のように入力と出力が決まって
いるものが対象。DB アクセスや画面は対象外。

- テストランナーは **Node 組み込みの `node:test`**。外部のテストフレームワークは入れない
- 本体の隣に `*.test.ts` で置き、`import { x } from "./bets.ts"` のように**拡張子付きで**
  読む（素の Node で TypeScript を動かすため）
- `pnpm test` で走る

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
- node / pnpm のバージョンは mise で管理している。**Node は 24 に固定**（`.mise.toml`）。
  Vercel が 26 に非対応のため、本番と揃えている
- pnpm の設定（overrides・allowBuilds など）は `package.json` ではなく
  `pnpm-workspace.yaml` に書く。pnpm 11 は `package.json` の `pnpm` フィールドを読まない
- **Node を直接使うスクリプトは、先頭で mise の shims を PATH の手前に足している。**
  mise を有効にしていないシェル（エージェントが叩く非対話シェルなど）では PATH の手前に
  別の Node が来て、TypeScript を直接読めずに落ちるため。おかげで `pnpm test` などは
  そのまま叩いてよく、`mise exec` で包む必要はない

## データの扱い

- 情報源から自動で本文を取り込むのではなく、**自分の目で見て、自分の言葉で要約・評価した
  内容をナレッジに登録する**のが原則
- 自動アクセスを禁止するドメインのリストを持つ。リストにあるドメインへエージェントから
  アクセスしない。**リストはまだ空のため、現時点では自動収集を行わない**
- JRA-VAN は商用利用不可

詳細は [docs/compliance.md](docs/compliance.md) を参照。

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.
<!-- END:nextjs-agent-rules -->
