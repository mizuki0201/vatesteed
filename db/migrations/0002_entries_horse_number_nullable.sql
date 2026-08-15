-- entries.horse_number を null 可にする。
--
-- 根拠は docs/data-model.md の entries。
--
-- 理由: 過去の出走を後から登録するときに、馬番が取れないことが普通に起きる。2026年の
-- 札幌記念を登録した際、天皇賞(春)の馬番だけ確かな情報源が見つからず、NOT NULL に
-- 引っかかって登録が落ちた。騎手・厩舎・枠番・斤量は同じ理由で既に null 可にしてあり、
-- 馬番だけ必須なのは実際の登録のしかたと合っていない。
--
-- UNIQUE (race_id, horse_number) はそのまま残す。Postgres は既定で null を互いに
-- 異なる値として扱うので、馬番が分からない出走が同じレースに複数あっても弾かれない。
-- 馬番が入っている出走どうしの重複は、これまでどおり塞がれる。
--
-- CHECK (horse_number > 0) もそのまま。null に対しては null を返すので通る。

ALTER TABLE entries ALTER COLUMN horse_number DROP NOT NULL;
