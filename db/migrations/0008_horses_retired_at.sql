-- 引退が確認できた馬だけを明示する。確認できない馬は現役として扱うため、現役馬を
-- 誤って引退に分類しない。

ALTER TABLE horses
  ADD COLUMN retired_at date;
