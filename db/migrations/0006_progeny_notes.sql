-- 産駒の傾向を、その馬自身の血統評価とは別のテーブルに持つ。
--
-- 根拠は docs/data-model.md の評価。
--
-- 理由: 種牡馬を horses に登録して pedigree_notes に見立てを溜める形にしたところ、1つの行に
-- 「レイデオロ自身の血統」と「レイデオロ産駒の傾向」という別のものが混ざることになった。
-- アドマイヤテラの血統を読むときはアドマイヤミヤビの母系まで含めた総合の話になるが、
-- 産駒の成績が知りたいときは父の側から引きたい。指すものが違う。
--
-- 同じ行に2つのカラムを持つ案は採らない。author と updated_at が共有されるため。
-- 血統は変わらないが産駒の傾向は世代が走るたびに変わるので、産駒側を更新した瞬間に
-- 血統評価まで「今日時点」になり、docs/data-model.md の「updated_at でいつ時点の話かを持つ」が
-- 壊れる。author も、血統は AI・産駒は対話のように分かれうる。
--
-- 別テーブルにすると、評価テーブルの「対象 + 内容 + 書いた人 + 更新日」という揃った形を
-- 崩さずに済む。decisions/0002 で対象ごとに分けると決めた形をそのまま延長したもので、
-- 役に配ってある書き込みの1文も、テーブル名を置き換えるだけで通る。
--
-- scope は pedigree_notes と同じく自由記述だが、意味が違う。あちらは「何代遡ったか」、
-- こちらは「どの範囲の産駒を見たか」（何年産まで、中央の芝だけ、など）。産駒の傾向は
-- 出走機会の偏りを受けるので、どの範囲を見た話なのかが分からないと後から割り引けない。
--
-- テーブル追加なので、decisions/0004 に従い Neon のブランチは切らない。

CREATE TABLE progeny_notes (
  id         bigserial                NOT NULL,
  horse_id   bigint                   NOT NULL,
  body       text                     NOT NULL,
  scope      text,
  author     text                     NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT progeny_notes_pkey PRIMARY KEY (id),
  CONSTRAINT progeny_notes_horse_id_key UNIQUE (horse_id),
  CONSTRAINT progeny_notes_author_check CHECK ((author = ANY (ARRAY['AI'::text, '人間'::text, '対話'::text])))
);

ALTER TABLE progeny_notes ADD CONSTRAINT progeny_notes_horse_id_fkey FOREIGN KEY (horse_id) REFERENCES horses(id) ON DELETE CASCADE;

CREATE TRIGGER progeny_notes_set_updated_at BEFORE UPDATE ON progeny_notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
