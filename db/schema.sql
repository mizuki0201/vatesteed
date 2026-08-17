-- このファイルは `pnpm db:migrate` が自動生成する。手で編集しない。
-- スキーマを変えるときは db/migrations/ に新しい .sql を足して流す。
--
-- 今DBにあるテーブルの姿をそのまま写したもので、読むためのファイル。
--
-- 適用済みマイグレーション:
--   0001_initial.sql
--   0002_entries_horse_number_nullable.sql
--   0003_races_race_number_nullable.sql
--   0004_entries_body_weight.sql
--   0005_race_payouts_and_margin.sql
--   0006_progeny_notes.sql
--   0007_races_entry_list_complete.sql
--   0008_horses_retired_at.sql

-- ---------------------------------------------------------------------------
-- 関数
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- テーブル
-- ---------------------------------------------------------------------------

CREATE TABLE ai_bet_legs (
  id             bigserial                NOT NULL,
  ai_bet_id      bigint                   NOT NULL,
  leg_group      integer                  NOT NULL,
  entry_id       bigint,
  bracket_number integer,
  created_at     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_bet_legs_pkey PRIMARY KEY (id),
  CONSTRAINT ai_bet_legs_unique_target UNIQUE NULLS NOT DISTINCT (ai_bet_id, leg_group, entry_id, bracket_number),
  CONSTRAINT ai_bet_legs_bracket_number_check CHECK (((bracket_number >= 1) AND (bracket_number <= 8))),
  CONSTRAINT ai_bet_legs_leg_group_check CHECK ((leg_group > 0)),
  CONSTRAINT ai_bet_legs_one_target CHECK ((num_nonnulls(entry_id, bracket_number) = 1))
);

CREATE TABLE ai_bets (
  id                bigserial                NOT NULL,
  race_id           bigint,
  ticket_type       text                     NOT NULL,
  bet_style         text                     NOT NULL,
  is_multi          boolean                  NOT NULL DEFAULT false,
  unit_amount       integer                  NOT NULL,
  combination_count integer                  NOT NULL,
  total_amount      integer                  NOT NULL,
  payout            integer,
  refund            integer,
  created_at        timestamp with time zone NOT NULL DEFAULT now(),
  updated_at        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_bets_pkey PRIMARY KEY (id),
  CONSTRAINT ai_bets_bet_style_check CHECK ((bet_style = ANY (ARRAY['単点'::text, 'ボックス'::text, '流し'::text, 'フォーメーション'::text]))),
  CONSTRAINT ai_bets_combination_count_check CHECK ((combination_count > 0)),
  CONSTRAINT ai_bets_multi_only_ordered CHECK (((is_multi = false) OR (ticket_type = ANY (ARRAY['馬単'::text, '3連単'::text])))),
  CONSTRAINT ai_bets_payout_check CHECK ((payout >= 0)),
  CONSTRAINT ai_bets_race_required CHECK (((ticket_type = 'WIN5'::text) OR (race_id IS NOT NULL))),
  CONSTRAINT ai_bets_refund_check CHECK ((refund >= 0)),
  CONSTRAINT ai_bets_ticket_type_check CHECK ((ticket_type = ANY (ARRAY['単勝'::text, '複勝'::text, '枠連'::text, '馬連'::text, '馬単'::text, 'ワイド'::text, '3連複'::text, '3連単'::text, 'WIN5'::text]))),
  CONSTRAINT ai_bets_total_amount_check CHECK ((total_amount > 0)),
  CONSTRAINT ai_bets_unit_amount_check CHECK (((unit_amount > 0) AND ((unit_amount % 100) = 0)))
);

CREATE TABLE ai_predictions (
  id           bigserial                NOT NULL,
  entry_id     bigint                   NOT NULL,
  mark_id      bigint,
  rationale    text,
  predicted_at timestamp with time zone NOT NULL,
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  updated_at   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_predictions_pkey PRIMARY KEY (id),
  CONSTRAINT ai_predictions_entry_id_key UNIQUE (entry_id)
);

CREATE TABLE course_notes (
  id         bigserial                NOT NULL,
  course_id  bigint                   NOT NULL,
  body       text                     NOT NULL,
  author     text                     NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT course_notes_pkey PRIMARY KEY (id),
  CONSTRAINT course_notes_course_id_key UNIQUE (course_id),
  CONSTRAINT course_notes_author_check CHECK ((author = ANY (ARRAY['AI'::text, '人間'::text, '対話'::text])))
);

CREATE TABLE courses (
  id         bigserial                NOT NULL,
  track      text                     NOT NULL,
  surface    text                     NOT NULL,
  distance_m integer                  NOT NULL,
  turn       text                     NOT NULL,
  layout     text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT courses_pkey PRIMARY KEY (id),
  CONSTRAINT courses_natural_key UNIQUE NULLS NOT DISTINCT (track, surface, distance_m, layout),
  CONSTRAINT courses_distance_m_check CHECK ((distance_m > 0)),
  CONSTRAINT courses_layout_check CHECK ((layout = ANY (ARRAY['内'::text, '外'::text]))),
  CONSTRAINT courses_surface_check CHECK ((surface = ANY (ARRAY['芝'::text, 'ダート'::text, '障害'::text]))),
  CONSTRAINT courses_turn_check CHECK ((turn = ANY (ARRAY['右'::text, '左'::text, '直線'::text])))
);

CREATE TABLE entries (
  id               bigserial                NOT NULL,
  race_id          bigint                   NOT NULL,
  horse_id         bigint                   NOT NULL,
  jockey_id        bigint,
  trainer_id       bigint,
  bracket_number   integer,
  horse_number     integer,
  weight_carried   numeric(4,1),
  status           text                     NOT NULL,
  finish_position  integer,
  popularity       integer,
  win_odds         numeric(6,1),
  finish_time_ms   integer,
  last_3f_ms       integer,
  corner_positions text,
  created_at       timestamp with time zone NOT NULL DEFAULT now(),
  updated_at       timestamp with time zone NOT NULL DEFAULT now(),
  body_weight      integer,
  body_weight_diff integer,
  margin           text,
  CONSTRAINT entries_pkey PRIMARY KEY (id),
  CONSTRAINT entries_race_horse_key UNIQUE (race_id, horse_id),
  CONSTRAINT entries_race_number_key UNIQUE (race_id, horse_number),
  CONSTRAINT entries_body_weight_check CHECK ((body_weight > 0)),
  CONSTRAINT entries_bracket_number_check CHECK (((bracket_number >= 1) AND (bracket_number <= 8))),
  CONSTRAINT entries_finish_only_when_ran CHECK (((status = '出走'::text) OR (finish_position IS NULL))),
  CONSTRAINT entries_finish_position_check CHECK ((finish_position > 0)),
  CONSTRAINT entries_horse_number_check CHECK ((horse_number > 0)),
  CONSTRAINT entries_popularity_check CHECK ((popularity > 0)),
  CONSTRAINT entries_status_check CHECK ((status = ANY (ARRAY['出走'::text, '取消'::text, '除外'::text, '中止'::text, '失格'::text])))
);

CREATE TABLE entry_notes (
  id         bigserial                NOT NULL,
  entry_id   bigint                   NOT NULL,
  body       text                     NOT NULL,
  author     text                     NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT entry_notes_pkey PRIMARY KEY (id),
  CONSTRAINT entry_notes_entry_id_key UNIQUE (entry_id),
  CONSTRAINT entry_notes_author_check CHECK ((author = ANY (ARRAY['AI'::text, '人間'::text, '対話'::text])))
);

CREATE TABLE horse_notes (
  id         bigserial                NOT NULL,
  horse_id   bigint                   NOT NULL,
  body       text                     NOT NULL,
  author     text                     NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT horse_notes_pkey PRIMARY KEY (id),
  CONSTRAINT horse_notes_horse_id_key UNIQUE (horse_id),
  CONSTRAINT horse_notes_author_check CHECK ((author = ANY (ARRAY['AI'::text, '人間'::text, '対話'::text])))
);

CREATE TABLE horses (
  id         bigserial                NOT NULL,
  name       text                     NOT NULL,
  name_kana  text,
  birth_year integer,
  sex        text,
  sire_id    bigint,
  dam_id     bigint,
  trainer_id bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  retired_at date,
  CONSTRAINT horses_pkey PRIMARY KEY (id),
  CONSTRAINT horses_sex_check CHECK ((sex = ANY (ARRAY['牡'::text, '牝'::text, 'セン'::text])))
);

CREATE TABLE jockey_notes (
  id         bigserial                NOT NULL,
  jockey_id  bigint                   NOT NULL,
  body       text                     NOT NULL,
  author     text                     NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT jockey_notes_pkey PRIMARY KEY (id),
  CONSTRAINT jockey_notes_jockey_id_key UNIQUE (jockey_id),
  CONSTRAINT jockey_notes_author_check CHECK ((author = ANY (ARRAY['AI'::text, '人間'::text, '対話'::text])))
);

CREATE TABLE jockeys (
  id          bigserial                NOT NULL,
  name        text                     NOT NULL,
  name_kana   text,
  birth_year  integer,
  debut_year  integer,
  affiliation text,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT jockeys_pkey PRIMARY KEY (id),
  CONSTRAINT jockeys_affiliation_check CHECK ((affiliation = ANY (ARRAY['美浦'::text, '栗東'::text, '地方'::text, '外国'::text])))
);

CREATE TABLE marks (
  id         bigserial                NOT NULL,
  name       text                     NOT NULL,
  symbol     text                     NOT NULL,
  sort_order integer                  NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT marks_pkey PRIMARY KEY (id),
  CONSTRAINT marks_name_key UNIQUE (name),
  CONSTRAINT marks_sort_order_key UNIQUE (sort_order),
  CONSTRAINT marks_symbol_key UNIQUE (symbol)
);

CREATE TABLE my_bet_legs (
  id             bigserial                NOT NULL,
  my_bet_id      bigint                   NOT NULL,
  leg_group      integer                  NOT NULL,
  entry_id       bigint,
  bracket_number integer,
  created_at     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT my_bet_legs_pkey PRIMARY KEY (id),
  CONSTRAINT my_bet_legs_unique_target UNIQUE NULLS NOT DISTINCT (my_bet_id, leg_group, entry_id, bracket_number),
  CONSTRAINT my_bet_legs_bracket_number_check CHECK (((bracket_number >= 1) AND (bracket_number <= 8))),
  CONSTRAINT my_bet_legs_leg_group_check CHECK ((leg_group > 0)),
  CONSTRAINT my_bet_legs_one_target CHECK ((num_nonnulls(entry_id, bracket_number) = 1))
);

CREATE TABLE my_bets (
  id                bigserial                NOT NULL,
  race_id           bigint,
  ticket_type       text                     NOT NULL,
  bet_style         text                     NOT NULL,
  is_multi          boolean                  NOT NULL DEFAULT false,
  unit_amount       integer                  NOT NULL,
  combination_count integer                  NOT NULL,
  total_amount      integer                  NOT NULL,
  payout            integer,
  refund            integer,
  created_at        timestamp with time zone NOT NULL DEFAULT now(),
  updated_at        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT my_bets_pkey PRIMARY KEY (id),
  CONSTRAINT my_bets_bet_style_check CHECK ((bet_style = ANY (ARRAY['単点'::text, 'ボックス'::text, '流し'::text, 'フォーメーション'::text]))),
  CONSTRAINT my_bets_combination_count_check CHECK ((combination_count > 0)),
  CONSTRAINT my_bets_multi_only_ordered CHECK (((is_multi = false) OR (ticket_type = ANY (ARRAY['馬単'::text, '3連単'::text])))),
  CONSTRAINT my_bets_payout_check CHECK ((payout >= 0)),
  CONSTRAINT my_bets_race_required CHECK (((ticket_type = 'WIN5'::text) OR (race_id IS NOT NULL))),
  CONSTRAINT my_bets_refund_check CHECK ((refund >= 0)),
  CONSTRAINT my_bets_ticket_type_check CHECK ((ticket_type = ANY (ARRAY['単勝'::text, '複勝'::text, '枠連'::text, '馬連'::text, '馬単'::text, 'ワイド'::text, '3連複'::text, '3連単'::text, 'WIN5'::text]))),
  CONSTRAINT my_bets_total_amount_check CHECK ((total_amount > 0)),
  CONSTRAINT my_bets_unit_amount_check CHECK (((unit_amount > 0) AND ((unit_amount % 100) = 0)))
);

CREATE TABLE my_predictions (
  id           bigserial                NOT NULL,
  entry_id     bigint                   NOT NULL,
  mark_id      bigint,
  rationale    text,
  predicted_at timestamp with time zone NOT NULL,
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  updated_at   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT my_predictions_pkey PRIMARY KEY (id),
  CONSTRAINT my_predictions_entry_id_key UNIQUE (entry_id)
);

CREATE TABLE pedigree_notes (
  id         bigserial                NOT NULL,
  horse_id   bigint                   NOT NULL,
  body       text                     NOT NULL,
  scope      text,
  author     text                     NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pedigree_notes_pkey PRIMARY KEY (id),
  CONSTRAINT pedigree_notes_horse_id_key UNIQUE (horse_id),
  CONSTRAINT pedigree_notes_author_check CHECK ((author = ANY (ARRAY['AI'::text, '人間'::text, '対話'::text])))
);

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

CREATE TABLE race_notes (
  id         bigserial                NOT NULL,
  race_id    bigint                   NOT NULL,
  body       text                     NOT NULL,
  author     text                     NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT race_notes_pkey PRIMARY KEY (id),
  CONSTRAINT race_notes_race_id_key UNIQUE (race_id),
  CONSTRAINT race_notes_author_check CHECK ((author = ANY (ARRAY['AI'::text, '人間'::text, '対話'::text])))
);

CREATE TABLE race_payouts (
  id          bigserial                NOT NULL,
  race_id     bigint                   NOT NULL,
  ticket_type text                     NOT NULL,
  combination text                     NOT NULL,
  amount      integer                  NOT NULL,
  popularity  integer,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT race_payouts_pkey PRIMARY KEY (id),
  CONSTRAINT race_payouts_natural_key UNIQUE (race_id, ticket_type, combination),
  CONSTRAINT race_payouts_amount_check CHECK ((amount > 0)),
  CONSTRAINT race_payouts_popularity_check CHECK ((popularity > 0)),
  CONSTRAINT race_payouts_ticket_type_check CHECK ((ticket_type = ANY (ARRAY['単勝'::text, '複勝'::text, '枠連'::text, '馬連'::text, '馬単'::text, 'ワイド'::text, '3連複'::text, '3連単'::text])))
);

CREATE TABLE race_predictions (
  id           bigserial                NOT NULL,
  race_id      bigint                   NOT NULL,
  body         text                     NOT NULL,
  author       text                     NOT NULL,
  predicted_at timestamp with time zone NOT NULL,
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  updated_at   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT race_predictions_pkey PRIMARY KEY (id),
  CONSTRAINT race_predictions_race_id_key UNIQUE (race_id),
  CONSTRAINT race_predictions_author_check CHECK ((author = ANY (ARRAY['AI'::text, '対話'::text])))
);

CREATE TABLE races (
  id                  bigserial                NOT NULL,
  race_date           date                     NOT NULL,
  course_id           bigint                   NOT NULL,
  meeting_number      integer,
  meeting_day         integer,
  race_number         integer,
  race_name           text,
  grade               text,
  weight_rule         text,
  weather_forecast    text,
  track_condition     text,
  weather             text,
  created_at          timestamp with time zone NOT NULL DEFAULT now(),
  updated_at          timestamp with time zone NOT NULL DEFAULT now(),
  entry_list_complete boolean                  NOT NULL DEFAULT false,
  CONSTRAINT races_pkey PRIMARY KEY (id),
  CONSTRAINT races_natural_key UNIQUE (race_date, course_id, race_number),
  CONSTRAINT races_grade_check CHECK ((grade = ANY (ARRAY['G1'::text, 'G2'::text, 'G3'::text, 'J.G1'::text, 'J.G2'::text, 'J.G3'::text, 'Jpn1'::text, 'Jpn2'::text, 'Jpn3'::text, 'OP'::text, 'L'::text, '3勝'::text, '2勝'::text, '1勝'::text, '新馬'::text, '未勝利'::text]))),
  CONSTRAINT races_race_number_check CHECK ((race_number > 0)),
  CONSTRAINT races_track_condition_check CHECK ((track_condition = ANY (ARRAY['良'::text, '稍重'::text, '重'::text, '不良'::text]))),
  CONSTRAINT races_weather_check CHECK ((weather = ANY (ARRAY['晴'::text, '曇'::text, '小雨'::text, '雨'::text, '小雪'::text, '雪'::text]))),
  CONSTRAINT races_weight_rule_check CHECK ((weight_rule = ANY (ARRAY['馬齢'::text, '別定'::text, '定量'::text, 'ハンデ'::text])))
);

CREATE TABLE trainer_notes (
  id         bigserial                NOT NULL,
  trainer_id bigint                   NOT NULL,
  body       text                     NOT NULL,
  author     text                     NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trainer_notes_pkey PRIMARY KEY (id),
  CONSTRAINT trainer_notes_trainer_id_key UNIQUE (trainer_id),
  CONSTRAINT trainer_notes_author_check CHECK ((author = ANY (ARRAY['AI'::text, '人間'::text, '対話'::text])))
);

CREATE TABLE trainers (
  id          bigserial                NOT NULL,
  name        text                     NOT NULL,
  name_kana   text,
  opened_on   date,
  affiliation text,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trainers_pkey PRIMARY KEY (id),
  CONSTRAINT trainers_affiliation_check CHECK ((affiliation = ANY (ARRAY['美浦'::text, '栗東'::text, '地方'::text, '外国'::text])))
);

CREATE TABLE users (
  id           bigserial                NOT NULL,
  email        text                     NOT NULL,
  access_level text                     NOT NULL,
  grant_source text                     NOT NULL,
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  updated_at   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_email_key UNIQUE (email),
  CONSTRAINT users_access_level_check CHECK ((access_level = ANY (ARRAY['owner'::text, 'friend'::text, 'member'::text, 'public'::text]))),
  CONSTRAINT users_grant_source_check CHECK ((grant_source = ANY (ARRAY['owner'::text, 'manual'::text, 'note'::text])))
);

-- ---------------------------------------------------------------------------
-- 外部キー
-- ---------------------------------------------------------------------------

ALTER TABLE ai_bet_legs ADD CONSTRAINT ai_bet_legs_ai_bet_id_fkey FOREIGN KEY (ai_bet_id) REFERENCES ai_bets(id) ON DELETE CASCADE;
ALTER TABLE ai_bet_legs ADD CONSTRAINT ai_bet_legs_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE RESTRICT;
ALTER TABLE ai_bets ADD CONSTRAINT ai_bets_race_id_fkey FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE RESTRICT;
ALTER TABLE ai_predictions ADD CONSTRAINT ai_predictions_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE;
ALTER TABLE ai_predictions ADD CONSTRAINT ai_predictions_mark_id_fkey FOREIGN KEY (mark_id) REFERENCES marks(id) ON DELETE RESTRICT;
ALTER TABLE course_notes ADD CONSTRAINT course_notes_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE entries ADD CONSTRAINT entries_horse_id_fkey FOREIGN KEY (horse_id) REFERENCES horses(id) ON DELETE RESTRICT;
ALTER TABLE entries ADD CONSTRAINT entries_jockey_id_fkey FOREIGN KEY (jockey_id) REFERENCES jockeys(id) ON DELETE RESTRICT;
ALTER TABLE entries ADD CONSTRAINT entries_race_id_fkey FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE RESTRICT;
ALTER TABLE entries ADD CONSTRAINT entries_trainer_id_fkey FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE RESTRICT;
ALTER TABLE entry_notes ADD CONSTRAINT entry_notes_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE;
ALTER TABLE horse_notes ADD CONSTRAINT horse_notes_horse_id_fkey FOREIGN KEY (horse_id) REFERENCES horses(id) ON DELETE CASCADE;
ALTER TABLE horses ADD CONSTRAINT horses_dam_id_fkey FOREIGN KEY (dam_id) REFERENCES horses(id) ON DELETE RESTRICT;
ALTER TABLE horses ADD CONSTRAINT horses_sire_id_fkey FOREIGN KEY (sire_id) REFERENCES horses(id) ON DELETE RESTRICT;
ALTER TABLE horses ADD CONSTRAINT horses_trainer_id_fkey FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE RESTRICT;
ALTER TABLE jockey_notes ADD CONSTRAINT jockey_notes_jockey_id_fkey FOREIGN KEY (jockey_id) REFERENCES jockeys(id) ON DELETE CASCADE;
ALTER TABLE my_bet_legs ADD CONSTRAINT my_bet_legs_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE RESTRICT;
ALTER TABLE my_bet_legs ADD CONSTRAINT my_bet_legs_my_bet_id_fkey FOREIGN KEY (my_bet_id) REFERENCES my_bets(id) ON DELETE CASCADE;
ALTER TABLE my_bets ADD CONSTRAINT my_bets_race_id_fkey FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE RESTRICT;
ALTER TABLE my_predictions ADD CONSTRAINT my_predictions_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE;
ALTER TABLE my_predictions ADD CONSTRAINT my_predictions_mark_id_fkey FOREIGN KEY (mark_id) REFERENCES marks(id) ON DELETE RESTRICT;
ALTER TABLE pedigree_notes ADD CONSTRAINT pedigree_notes_horse_id_fkey FOREIGN KEY (horse_id) REFERENCES horses(id) ON DELETE CASCADE;
ALTER TABLE progeny_notes ADD CONSTRAINT progeny_notes_horse_id_fkey FOREIGN KEY (horse_id) REFERENCES horses(id) ON DELETE CASCADE;
ALTER TABLE race_notes ADD CONSTRAINT race_notes_race_id_fkey FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE;
ALTER TABLE race_payouts ADD CONSTRAINT race_payouts_race_id_fkey FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE;
ALTER TABLE race_predictions ADD CONSTRAINT race_predictions_race_id_fkey FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE;
ALTER TABLE races ADD CONSTRAINT races_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT;
ALTER TABLE trainer_notes ADD CONSTRAINT trainer_notes_trainer_id_fkey FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- インデックス
-- ---------------------------------------------------------------------------

CREATE INDEX ai_bets_race_id_idx ON public.ai_bets USING btree (race_id);
CREATE INDEX entries_horse_id_idx ON public.entries USING btree (horse_id);
CREATE INDEX entries_jockey_id_idx ON public.entries USING btree (jockey_id);
CREATE INDEX entries_trainer_id_idx ON public.entries USING btree (trainer_id);
CREATE INDEX horses_dam_id_idx ON public.horses USING btree (dam_id);
CREATE INDEX horses_name_idx ON public.horses USING btree (name);
CREATE INDEX horses_sire_id_idx ON public.horses USING btree (sire_id);
CREATE INDEX horses_trainer_id_idx ON public.horses USING btree (trainer_id);
CREATE INDEX jockeys_name_idx ON public.jockeys USING btree (name);
CREATE INDEX my_bets_race_id_idx ON public.my_bets USING btree (race_id);
CREATE INDEX race_payouts_race_id_idx ON public.race_payouts USING btree (race_id);
CREATE INDEX races_course_id_idx ON public.races USING btree (course_id);
CREATE INDEX races_race_date_idx ON public.races USING btree (race_date);
CREATE INDEX trainers_name_idx ON public.trainers USING btree (name);

-- ---------------------------------------------------------------------------
-- トリガー
-- ---------------------------------------------------------------------------

CREATE TRIGGER ai_bets_set_updated_at BEFORE UPDATE ON public.ai_bets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER ai_predictions_set_updated_at BEFORE UPDATE ON public.ai_predictions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER course_notes_set_updated_at BEFORE UPDATE ON public.course_notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER courses_set_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER entries_set_updated_at BEFORE UPDATE ON public.entries FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER entry_notes_set_updated_at BEFORE UPDATE ON public.entry_notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER horse_notes_set_updated_at BEFORE UPDATE ON public.horse_notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER horses_set_updated_at BEFORE UPDATE ON public.horses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER jockey_notes_set_updated_at BEFORE UPDATE ON public.jockey_notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER jockeys_set_updated_at BEFORE UPDATE ON public.jockeys FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER marks_set_updated_at BEFORE UPDATE ON public.marks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER my_bets_set_updated_at BEFORE UPDATE ON public.my_bets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER my_predictions_set_updated_at BEFORE UPDATE ON public.my_predictions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER pedigree_notes_set_updated_at BEFORE UPDATE ON public.pedigree_notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER progeny_notes_set_updated_at BEFORE UPDATE ON public.progeny_notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER race_notes_set_updated_at BEFORE UPDATE ON public.race_notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER race_payouts_set_updated_at BEFORE UPDATE ON public.race_payouts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER race_predictions_set_updated_at BEFORE UPDATE ON public.race_predictions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER races_set_updated_at BEFORE UPDATE ON public.races FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trainer_notes_set_updated_at BEFORE UPDATE ON public.trainer_notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trainers_set_updated_at BEFORE UPDATE ON public.trainers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
