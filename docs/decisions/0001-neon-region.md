# Neon のリージョンを Singapore にする

- 日付: 2026-08-08
- 状態: 採用

## 背景

Neon はプロジェクト作成時にリージョンを決め、**後から変更できない**。移すには別リージョンに
新しいプロジェクトを作ってデータを移行する必要がある。そのため最初の選択が効く。

**Neon に東京リージョンは無い。** 選べるのは AWS の8リージョンのみ（Azure は非推奨で新規受付
停止）。

- 米国: N. Virginia / Ohio / Oregon
- 欧州: Frankfurt / London
- アジア太平洋: **Singapore (`ap-southeast-1`)** / Sydney
- 南米: São Paulo

日本から最も近いのは Singapore。

一方 Vercel Functions のデフォルトは `iad1`（ワシントンD.C.）で、Hobby プランは1リージョンのみ。
ただし**どのリージョンにするかは選択できる**（Settings → Functions → Function Regions）。
Vercel のドキュメントは「関数はデータソースの近くに置け」と明記している。つまり効くのは
ユーザーとDBの距離ではなく、**関数とDBの距離**。

## 決定

- Neon のリージョンは **AWS Asia Pacific (Singapore) / `ap-southeast-1`**
- Vercel の Function Region も **Singapore (`sin1`)** に変更し、DBと同居させる

## 検討したが採らなかった案

### Neon us-east-1 + Vercel `iad1`（どちらもデフォルト）

関数とDBは同居するが、**Phase 1 の主役が手元のマシンである**点と噛み合わない。いまナレッジを
読み書きするのは Vercel 上のコードではなく、日本で動く Claude Code。DBが米東部だと、対話しながら
何度もクエリを投げる作業のたびに太平洋を往復することになる。

### Neon Singapore + Vercel `hnd1`（東京）

読者から関数までは近くなるが、関数からDBまでが遠くなる。ダッシュボードは1リクエストで複数
クエリを投げるので、離れた分がクエリ回数だけ効く。ユーザーと関数の距離は1リクエストにつき
1回分でしかない。静的コンテンツは CDN から配信されるため、記事や公開ページの体感は Function
Region にあまり左右されない。

この案が有利になるのは、DBをほとんど触らない動的ページが主体になった場合。現状の想定とは逆。

## 影響

- **Vercel の Function Region を `sin1` に変更する必要がある。** デフォルトの `iad1` のまま
  放置すると、DBだけシンガポール・関数は米東部という最も悪い組み合わせになる
- 将来 Neon が東京リージョンを提供した場合、移行はデータ移行を伴う。乗り換える価値があるかは
  その時点で判断する

## 参考

- [Neon Regions](https://neon.com/docs/introduction/regions)
- [Configuring regions for Vercel Functions](https://vercel.com/docs/functions/configuring-functions/region)
