-- races.race_number を null 可にする。
--
-- 根拠は docs/data-model.md の races。
--
-- 理由: 0002 で entries.horse_number を null 可にしたのと同じ。海外・地方のレースを
-- 登録するときに、何レース目かが取れないことがある。2026年札幌記念の出走馬の近走を
-- 入れた際、香港のチャンピオンズ&チャターカップと川崎記念でこれに当たった。
-- meeting_number / meeting_day は同じ理由で最初から null 可にしてあり、race_number
-- だけ必須なのは筋が通らない。
--
-- 引き換えに UNIQUE (race_date, course_id, race_number) の守りが弱くなる。Postgres は
-- 既定で null を互いに異なる値として扱うので、race_number が null の行は同じ日・同じ
-- 競馬場でも重複して入る。中央のレースは race_number が埋まるのでこれまでどおり塞がれ、
-- 緩むのは番号が取れないレースだけ。そこは登録の前に名前で探す手順で守る。

ALTER TABLE races ALTER COLUMN race_number DROP NOT NULL;
