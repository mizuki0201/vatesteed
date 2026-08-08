# アーキテクチャ

## 全体構成

- **eve の構成でプロジェクトを作る**が、Phase 1 で動かすエンジンは **Claude Code**
- `CLAUDE.md` をブリッジファイルとして配置し、指示の実体は `AGENTS.md` に置く
- **ツールロジックは `lib/` に置き、`agent/tools/` はそれを呼ぶ薄いラッパーにする**
  - Phase 1 では Claude Code が `lib/` を直接叩くので、eve ランタイムは起動しない
    → サブスク内に収まる
  - Phase 3 で eve に載せる際、`agent/tools/` のラッパーを書くだけで移行できる
- **Next.js を同居させてダッシュボードを作る**（`app/` 配下）
  - `lib/` をエージェントと Next.js の両方から使う
  - eve は `/eve/v1/*` の HTTP API として動く。画面は自分で書く

## ディレクトリ（想定）

```
vatesteed/
  agent/
    agent.ts
    instructions.md
    tools/          # lib/ を呼ぶ薄いラッパー
    skills/
    schedules/
  app/
    (public)/
    (member)/
    (friend)/
    (private)/
  lib/              # 実体のロジック・DBアクセス
  docs/
  CLAUDE.md
```

現時点で存在するのは `agent/agent.ts` `agent/instructions.md` `agent/channels/eve.ts` と、
Next.js の初期構成のみ。`tools/` `skills/` `schedules/` および `app/` のルートグループは未作成。

## 開発フェーズ

| Phase | 内容 |
| --- | --- |
| 1 | Claude Code をインタラクティブに使う。eve ランタイムは起動しない |
| 2 | Claude Code の Routines でスケジュール実行 |
| 3 | eve ランタイム導入。eval による回帰テスト |

## リポジトリ

| 項目 | 決定 |
| --- | --- |
| 構成 | シングルモノレポ |
| 可視性 | **最初から Public**（.gitignore を最初のコミットから正しく効かせる前提） |
| 記事用リポジトリ | **別リポジトリ**。Zenn 連携は別で動く仕組みとして作る |

Public にできる理由: ナレッジDB・収支データを外部DBに置くため、リポジトリにセンシティブな
データが残らない。

原則: **秘匿したくなる実装があるなら、実装自体を見直すシグナル**。

## データベース

- **ナレッジDBは外部DB（Postgres）**。ローカルファイル + gitignore は、PC 移行リスクが
  あるため不採用
- DBインスタンスは1つ。テーブルで分ける
- **AI の予想・購入** と **自分の予想・購入** は別テーブル
- **自分の購入はエージェントの学習に自動反映しない**
  - AI = 膨大なデータから推論して当てにいく / 自分 = 趣味として楽しみ推し活もする、という
    役割分担
  - 反映したいと判断したときだけ、明示的にスキルを叩いてナレッジを更新する

候補: **Neon**（Vercel Marketplace 経由で環境変数が自動設定される。無料枠あり）。

Supabase は認証込みだが、一定期間アクセスがないとプロジェクトが一時停止する仕様があり、
週1運用と相性が悪い。

## ナレッジの性質

設計時に効く区別。

- **蓄積型**: 馬・騎手・血統・陣営コメント。走るたびに追記され、履歴が消えると価値が落ちる
- **都度取得型**: 馬場（開催何週目、A/B 替わり、含水率）、天候、当日馬体重、出走メンバー、
  枠順。鮮度が全て

ただし「先週の東京はこう変化した」の形で、都度型が蓄積型に転化する部分もある。

## アクセス制御

序列: **owner > friend > member > public**

| レベル | 重み | 備考 |
| --- | --- | --- |
| `owner` | 100 | |
| `friend` | 50 | member より **広く** 見える（自分の収支など） |
| `member` | 10 | |
| `public` | 0 | |

数値の重みを持たせると、後で間に有料プランを足せる。

ルーティング:

```
app/(public)/   ← 0以上
app/(member)/   ← 10以上
app/(friend)/   ← 50以上
app/(private)/  ← 100
```

**初期実装**: `lib/auth/getViewer.ts` に判定を隔離し、環境変数のパスワード一致で `owner` を
返すだけ。それ以外は `public`。テーブルは先に作るが、Phase 1 では参照しない。

テーブル定義は [data-model.md](data-model.md) を参照。

## 費用

- 現時点で発生する固定費はゼロ（Vercel 無料枠 + Neon 無料枠 + Claude Code サブスク）
- eve を実際に動かすのは Phase 3。そこで初めてトークン従量課金が乗る

## 環境

```
node  24.x     （.mise.toml で固定）
pnpm  11.20.0
```

**Node は 24 に固定する。** Vercel がランタイムとしてサポートするのは 24.x（デフォルト）/
22.x / 20.x のみで、**26 は非対応**（2026年8月確認）。本番と一致させるため、ローカルも 24 に
下げた。`package.json` の `engines.node` も `24.x` で揃えている。

- リポジトリの `.mise.toml` で `node = "24"` を指定している。ファイル名が `mise.toml` では
  なく `.mise.toml` なのは、古い mise（2024.3.6）が `mise.toml` を読まないため
- パッケージマネージャは pnpm。pnpm 11 は `package.json` の `pnpm` フィールドを読まないため、
  overrides や allowBuilds は `pnpm-workspace.yaml` に書く
- eve は beta のため、バージョンはレンジ指定にせず完全固定する

### Vercel 側の制約（未解決）

**Vercel の pnpm サポートは 6〜10 で、11 は一覧にない。** 生成される `pnpm-lock.yaml` は
`lockfileVersion: '9.0'` なので install 自体は pnpm 9 または 10 で通るが、
`pnpm-workspace.yaml` に書いた `allowBuilds` と `overrides` は pnpm 11 の書き方のため、
Vercel 側で無視される可能性がある。

回避策として、Vercel の環境変数に `ENABLE_EXPERIMENTAL_COREPACK=1` を設定すると
`packageManager: "pnpm@11.20.0"` が尊重される。ただし Vercel は Corepack を experimental と
明記している。**どちらを採るかは未確定。** 実際のビルドログでどの pnpm が使われたかを見てから
決める。

### デプロイと eve ランタイム

`next.config.ts` が `withEve(nextConfig)` を通しているため、Next.js アプリをデプロイすると
eve のエンドポイントも同時に出る。「Phase 1 では eve ランタイムを起動しない」という方針とは
厳密には一致しない。

ただし `agent/channels/eve.ts` の `placeholderAuth()` は `VERCEL_ENV === "production"` のとき
必ず `UnauthenticatedError` を投げ、preview でも最終的に 401 になる。外部から叩かれて
トークンを消費される状態にはならない。認証を差し替えるときはこの前提が崩れるので注意する。
