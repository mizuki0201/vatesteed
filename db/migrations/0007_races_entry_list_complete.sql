-- レース一覧には、予想対象として出馬表を全頭ぶん登録したレースだけを出す。
-- 馬の分析に伴って一部の出走だけを登録する過去レースと区別するため、登録完了を明示する。

ALTER TABLE races
  ADD COLUMN entry_list_complete boolean NOT NULL DEFAULT false;
