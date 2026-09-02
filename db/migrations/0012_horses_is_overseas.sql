-- 海外の馬を、現役・引退とは別の区分として持つ。
--
-- 根拠は docs/data-model.md の horses。画面での扱いは docs/product.md の /horses。
--
-- 理由: 馬の一覧は retired_at だけで現役と引退に分けていた。海外の馬はこの2つのどちらに
-- 入れても実態と合わない。引退を確認する手順（docs/data-model.md の retired_at）は日本の
-- 馬を前提にしていて、海外の馬には同じ確認ができないため、null のまま現役に混ざる。
--
-- 名前の文字種から毎回判定せず、列として持つ。判定の条件が画面の SQL に散らばると、
-- あとで海外かどうかを人が直したくなったときに直す先が無い。
--
-- null 可にしない。海外かどうかは登録の時点で必ずどちらかに決まる。既定を false に
-- するのは、これまでに登録した馬の大半が日本の馬だからで、意味のある既定として置く。
--
-- 既存の行は、馬名に ASCII のローマ字を1文字でも含むものを海外にする。カタカナ表記に
-- ローマ字が混ざる馬（「リプリートII」など）もここに入る。実行時点の本番DBでは326頭中
-- 30頭が当たる。
--
-- カラム追加なので、decisions/0004 に従い Neon のブランチは切らない。

ALTER TABLE horses
  ADD COLUMN is_overseas boolean NOT NULL DEFAULT false;

UPDATE horses
   SET is_overseas = true
 WHERE name ~ '[A-Za-z]';
