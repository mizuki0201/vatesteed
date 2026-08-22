-- 評価8テーブルの body と、pedigree_notes・progeny_notes の scope に、内部構造を直接表す
-- 言葉を書けなくする。
--
-- 正本は docs/agent-design.md の「評価の本文と、返すだけのメモ（2026-08-18 決定）」。
-- 経緯は docs/decisions/0005-notes-body-public-only.md。
--
-- 守るもの: body は、競馬の話をしている人が単独で読んで意味が通る文章だけを持つ。保存先の
-- 名前・役の名前・列の名前・DB という言葉のように、どう読んでも競馬の話にならない言葉を弾く。
-- 分析する役の指示だけでは再発する。書き込みの経路が pnpm db:query の生の SQL なので、
-- 指示を直しても書ける状態が残るため、書ける状態そのものを塞ぐ。
--
-- scope を外さない: 血統の側は馬の画面に本文と並べて出ており、body と同じく公開される保存値。
-- 本文だけを守っても、隣に内部の言葉が残る。scope を持つのはこの2テーブルだけ。
--
-- 守らないもの: 文脈は一切見ない。「未登録」「取れなかった」「担当」のような言葉は競馬の側の
-- 意味（登録抹消、出走登録）と重なるので入れていない。入れると正しい本文まで書けなくなる。
-- これは下限であって、通ったから公開してよいという意味ではない。上限は上記 docs の
-- 「本文に出さないもの」と、分析する役の書き込む前の見直しで決まる。
--
-- 照合は大文字小文字を区別する（!~）。本文には英字の馬名・競走名が入るため、パターンに
-- 書いたとおりの綴りだけを見る（null と NULL は両方を並べてある）。
--
-- 下のパターンは lib/notes/internal-terms.ts の INTERNAL_TERM_PATTERN と同じ文字列。
-- ずれていないことは lib/notes/internal-terms.test.ts が見ている。
--
-- 既存の行にも効く制約なので、流す前に既存の body と scope を公開してよい書き方へ直しておく。
-- データを失う変更ではないので、decisions/0004 に従い Neon のブランチは切らない。

ALTER TABLE entry_notes
  ADD CONSTRAINT entry_notes_body_no_internal_terms
  CHECK (body !~ 'courses|races|horses|jockeys|trainers|entries|race_laps|entry_notes|horse_notes|pedigree_notes|progeny_notes|jockey_notes|trainer_notes|course_notes|race_notes|entry_comments|marks|ai_predictions|my_predictions|race_predictions|race_prediction_conditions|ai_bets|ai_bet_legs|my_bets|my_bet_legs|race_payouts|users|-analyst|verifier|_id|null|NULL|author|scope|created_at|updated_at|corner_positions|DB|データベース|テーブル|カラム|サブエージェント|オーケストレーター|プロンプト|マイグレーション');

ALTER TABLE horse_notes
  ADD CONSTRAINT horse_notes_body_no_internal_terms
  CHECK (body !~ 'courses|races|horses|jockeys|trainers|entries|race_laps|entry_notes|horse_notes|pedigree_notes|progeny_notes|jockey_notes|trainer_notes|course_notes|race_notes|entry_comments|marks|ai_predictions|my_predictions|race_predictions|race_prediction_conditions|ai_bets|ai_bet_legs|my_bets|my_bet_legs|race_payouts|users|-analyst|verifier|_id|null|NULL|author|scope|created_at|updated_at|corner_positions|DB|データベース|テーブル|カラム|サブエージェント|オーケストレーター|プロンプト|マイグレーション');

ALTER TABLE pedigree_notes
  ADD CONSTRAINT pedigree_notes_body_no_internal_terms
  CHECK (body !~ 'courses|races|horses|jockeys|trainers|entries|race_laps|entry_notes|horse_notes|pedigree_notes|progeny_notes|jockey_notes|trainer_notes|course_notes|race_notes|entry_comments|marks|ai_predictions|my_predictions|race_predictions|race_prediction_conditions|ai_bets|ai_bet_legs|my_bets|my_bet_legs|race_payouts|users|-analyst|verifier|_id|null|NULL|author|scope|created_at|updated_at|corner_positions|DB|データベース|テーブル|カラム|サブエージェント|オーケストレーター|プロンプト|マイグレーション');

ALTER TABLE progeny_notes
  ADD CONSTRAINT progeny_notes_body_no_internal_terms
  CHECK (body !~ 'courses|races|horses|jockeys|trainers|entries|race_laps|entry_notes|horse_notes|pedigree_notes|progeny_notes|jockey_notes|trainer_notes|course_notes|race_notes|entry_comments|marks|ai_predictions|my_predictions|race_predictions|race_prediction_conditions|ai_bets|ai_bet_legs|my_bets|my_bet_legs|race_payouts|users|-analyst|verifier|_id|null|NULL|author|scope|created_at|updated_at|corner_positions|DB|データベース|テーブル|カラム|サブエージェント|オーケストレーター|プロンプト|マイグレーション');

ALTER TABLE jockey_notes
  ADD CONSTRAINT jockey_notes_body_no_internal_terms
  CHECK (body !~ 'courses|races|horses|jockeys|trainers|entries|race_laps|entry_notes|horse_notes|pedigree_notes|progeny_notes|jockey_notes|trainer_notes|course_notes|race_notes|entry_comments|marks|ai_predictions|my_predictions|race_predictions|race_prediction_conditions|ai_bets|ai_bet_legs|my_bets|my_bet_legs|race_payouts|users|-analyst|verifier|_id|null|NULL|author|scope|created_at|updated_at|corner_positions|DB|データベース|テーブル|カラム|サブエージェント|オーケストレーター|プロンプト|マイグレーション');

ALTER TABLE trainer_notes
  ADD CONSTRAINT trainer_notes_body_no_internal_terms
  CHECK (body !~ 'courses|races|horses|jockeys|trainers|entries|race_laps|entry_notes|horse_notes|pedigree_notes|progeny_notes|jockey_notes|trainer_notes|course_notes|race_notes|entry_comments|marks|ai_predictions|my_predictions|race_predictions|race_prediction_conditions|ai_bets|ai_bet_legs|my_bets|my_bet_legs|race_payouts|users|-analyst|verifier|_id|null|NULL|author|scope|created_at|updated_at|corner_positions|DB|データベース|テーブル|カラム|サブエージェント|オーケストレーター|プロンプト|マイグレーション');

ALTER TABLE course_notes
  ADD CONSTRAINT course_notes_body_no_internal_terms
  CHECK (body !~ 'courses|races|horses|jockeys|trainers|entries|race_laps|entry_notes|horse_notes|pedigree_notes|progeny_notes|jockey_notes|trainer_notes|course_notes|race_notes|entry_comments|marks|ai_predictions|my_predictions|race_predictions|race_prediction_conditions|ai_bets|ai_bet_legs|my_bets|my_bet_legs|race_payouts|users|-analyst|verifier|_id|null|NULL|author|scope|created_at|updated_at|corner_positions|DB|データベース|テーブル|カラム|サブエージェント|オーケストレーター|プロンプト|マイグレーション');

ALTER TABLE race_notes
  ADD CONSTRAINT race_notes_body_no_internal_terms
  CHECK (body !~ 'courses|races|horses|jockeys|trainers|entries|race_laps|entry_notes|horse_notes|pedigree_notes|progeny_notes|jockey_notes|trainer_notes|course_notes|race_notes|entry_comments|marks|ai_predictions|my_predictions|race_predictions|race_prediction_conditions|ai_bets|ai_bet_legs|my_bets|my_bet_legs|race_payouts|users|-analyst|verifier|_id|null|NULL|author|scope|created_at|updated_at|corner_positions|DB|データベース|テーブル|カラム|サブエージェント|オーケストレーター|プロンプト|マイグレーション');

-- scope は NULL 可（db/schema.sql）。Postgres の CHECK は NULL の行を通すので scope !~ だけでも
-- 実害は無いが、読む人に NULL 可だと分かるよう scope IS NULL を明示して書く。
ALTER TABLE pedigree_notes
  ADD CONSTRAINT pedigree_notes_scope_no_internal_terms
  CHECK (scope IS NULL OR scope !~ 'courses|races|horses|jockeys|trainers|entries|race_laps|entry_notes|horse_notes|pedigree_notes|progeny_notes|jockey_notes|trainer_notes|course_notes|race_notes|entry_comments|marks|ai_predictions|my_predictions|race_predictions|race_prediction_conditions|ai_bets|ai_bet_legs|my_bets|my_bet_legs|race_payouts|users|-analyst|verifier|_id|null|NULL|author|scope|created_at|updated_at|corner_positions|DB|データベース|テーブル|カラム|サブエージェント|オーケストレーター|プロンプト|マイグレーション');

ALTER TABLE progeny_notes
  ADD CONSTRAINT progeny_notes_scope_no_internal_terms
  CHECK (scope IS NULL OR scope !~ 'courses|races|horses|jockeys|trainers|entries|race_laps|entry_notes|horse_notes|pedigree_notes|progeny_notes|jockey_notes|trainer_notes|course_notes|race_notes|entry_comments|marks|ai_predictions|my_predictions|race_predictions|race_prediction_conditions|ai_bets|ai_bet_legs|my_bets|my_bet_legs|race_payouts|users|-analyst|verifier|_id|null|NULL|author|scope|created_at|updated_at|corner_positions|DB|データベース|テーブル|カラム|サブエージェント|オーケストレーター|プロンプト|マイグレーション');
