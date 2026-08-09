-- 初期スキーマ。22テーブル。
--
-- 定義の根拠は docs/data-model.md。このファイルは「今どうなっているか」ではなく
-- 「そのとき何を流したか」を残すものなので、後から書き換えない。変更は次の番号で足す。
--
-- 方針:
--   - enum 型は使わず text + CHECK 制約
--   - ID は自前の連番（bigserial）
--   - 履歴テーブルは持たない。評価は1対象1行の上書き

-- ---------------------------------------------------------------------------
-- updated_at の自動更新
-- ---------------------------------------------------------------------------
-- UPDATE 文で updated_at を書き忘れると「いつ時点の話か」が壊れる。
-- 人間と AI の両方が手で SQL を書く前提なので、DB 側で担保する。

CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 土台
-- ---------------------------------------------------------------------------

CREATE TABLE courses (
  id          bigserial PRIMARY KEY,
  track       text NOT NULL,
  surface     text NOT NULL CHECK (surface IN ('芝', 'ダート', '障害')),
  distance_m  int  NOT NULL CHECK (distance_m > 0),
  turn        text NOT NULL CHECK (turn IN ('右', '左', '直線')),
  -- 区別が無いコースは null
  layout      text CHECK (layout IN ('内', '外')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- 同じコースを二重に登録すると評価が分散するため塞ぐ。
  -- layout が null になるコースがあるので NULLS NOT DISTINCT が要る
  CONSTRAINT courses_natural_key UNIQUE NULLS NOT DISTINCT (track, surface, distance_m, layout)
);

CREATE TABLE jockeys (
  id           bigserial PRIMARY KEY,
  name         text NOT NULL,
  name_kana    text,
  birth_year   int,
  debut_year   int,
  affiliation  text CHECK (affiliation IN ('美浦', '栗東', '地方', '外国')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trainers (
  id           bigserial PRIMARY KEY,
  name         text NOT NULL,
  name_kana    text,
  opened_on    date,
  affiliation  text CHECK (affiliation IN ('美浦', '栗東', '地方', '外国')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE horses (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL,
  name_kana   text,
  birth_year  int,
  sex         text CHECK (sex IN ('牡', '牝', 'セン')),
  -- 血統をどこかで遡り終える必要があるため null 可
  sire_id     bigint REFERENCES horses(id) ON DELETE RESTRICT,
  dam_id      bigint REFERENCES horses(id) ON DELETE RESTRICT,
  -- 血統をたどるためだけに登録する先祖馬には厩舎が無いので null 可
  trainer_id  bigint REFERENCES trainers(id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 「この馬の過去走を全部」「この種牡馬の産駒」「この厩舎の管理馬」を引くため
CREATE INDEX horses_name_idx ON horses (name);
CREATE INDEX horses_sire_id_idx ON horses (sire_id);
CREATE INDEX horses_dam_id_idx ON horses (dam_id);
CREATE INDEX horses_trainer_id_idx ON horses (trainer_id);
CREATE INDEX jockeys_name_idx ON jockeys (name);
CREATE INDEX trainers_name_idx ON trainers (name);

CREATE TABLE races (
  id                bigserial PRIMARY KEY,
  race_date         date   NOT NULL,
  course_id         bigint NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  -- 開催回・日目。海外・地方は null
  meeting_number    int,
  meeting_day       int,
  race_number       int    NOT NULL CHECK (race_number > 0),
  -- JRA 正式名称のみ。条件戦は null。括弧・数字・英字は半角に正規化して入れる
  race_name         text,
  grade             text CHECK (grade IN (
                      'G1', 'G2', 'G3',
                      'J.G1', 'J.G2', 'J.G3',
                      'Jpn1', 'Jpn2', 'Jpn3',
                      'OP', 'L',
                      '3勝', '2勝', '1勝', '新馬', '未勝利')),
  weight_rule       text CHECK (weight_rule IN ('馬齢', '別定', '定量', 'ハンデ')),
  -- 予想時点の天気予報。「曇のち雨」のような自由記述なので CHECK を付けない
  weather_forecast  text,
  -- ここから下はレース後
  track_condition   text CHECK (track_condition IN ('良', '稍重', '重', '不良')),
  weather           text CHECK (weather IN ('晴', '曇', '小雨', '雨', '小雪', '雪')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- 同じレースの二重登録を塞ぐ
  CONSTRAINT races_natural_key UNIQUE (race_date, course_id, race_number)
);

CREATE INDEX races_race_date_idx ON races (race_date);
CREATE INDEX races_course_id_idx ON races (course_id);

CREATE TABLE entries (
  id                bigserial PRIMARY KEY,
  race_id           bigint NOT NULL REFERENCES races(id) ON DELETE RESTRICT,
  horse_id          bigint NOT NULL REFERENCES horses(id) ON DELETE RESTRICT,
  jockey_id         bigint REFERENCES jockeys(id) ON DELETE RESTRICT,
  -- 当時の厩舎。転厩があるため horses.trainer_id とは別に持つ
  trainer_id        bigint REFERENCES trainers(id) ON DELETE RESTRICT,
  bracket_number    int CHECK (bracket_number BETWEEN 1 AND 8),
  horse_number      int NOT NULL CHECK (horse_number > 0),
  weight_carried    numeric(4,1),
  status            text NOT NULL CHECK (status IN ('出走', '取消', '除外', '中止', '失格')),
  -- ここから下はレース後。着順は降着があれば降着後の確定着順
  finish_position   int CHECK (finish_position > 0),
  popularity        int CHECK (popularity > 0),
  win_odds          numeric(6,1),
  finish_time_ms    int,
  last_3f_ms        int,
  -- 通過順「1-1-2-4」
  corner_positions  text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT entries_race_horse_key UNIQUE (race_id, horse_id),
  CONSTRAINT entries_race_number_key UNIQUE (race_id, horse_number),
  -- 着順が入るのは status = '出走' のときだけ
  CONSTRAINT entries_finish_only_when_ran CHECK (status = '出走' OR finish_position IS NULL)
);

-- race_id は entries_race_horse_key の先頭列で引けるので張らない
CREATE INDEX entries_horse_id_idx ON entries (horse_id);
CREATE INDEX entries_jockey_id_idx ON entries (jockey_id);
CREATE INDEX entries_trainer_id_idx ON entries (trainer_id);

-- ---------------------------------------------------------------------------
-- 評価（7テーブル）
-- ---------------------------------------------------------------------------
-- 1つの対象につき1行。書き直しは上書きで、履歴は持たない。
-- 対象が消えたら評価も意味を失うので ON DELETE CASCADE。
-- ただし対象側（entries など）が RESTRICT で守られているため、
-- 評価が巻き込まれて消えるのは「その対象を意図して消したとき」だけになる。

CREATE TABLE entry_notes (
  id          bigserial PRIMARY KEY,
  entry_id    bigint NOT NULL UNIQUE REFERENCES entries(id) ON DELETE CASCADE,
  body        text NOT NULL,
  author      text NOT NULL CHECK (author IN ('AI', '人間', '対話')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE horse_notes (
  id          bigserial PRIMARY KEY,
  horse_id    bigint NOT NULL UNIQUE REFERENCES horses(id) ON DELETE CASCADE,
  body        text NOT NULL,
  author      text NOT NULL CHECK (author IN ('AI', '人間', '対話')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pedigree_notes (
  id          bigserial PRIMARY KEY,
  horse_id    bigint NOT NULL UNIQUE REFERENCES horses(id) ON DELETE CASCADE,
  body        text NOT NULL,
  -- どこまで遡ったか。「6代」「6代+全兄弟」のような自由記述
  scope       text,
  author      text NOT NULL CHECK (author IN ('AI', '人間', '対話')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE jockey_notes (
  id          bigserial PRIMARY KEY,
  jockey_id   bigint NOT NULL UNIQUE REFERENCES jockeys(id) ON DELETE CASCADE,
  body        text NOT NULL,
  author      text NOT NULL CHECK (author IN ('AI', '人間', '対話')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trainer_notes (
  id          bigserial PRIMARY KEY,
  trainer_id  bigint NOT NULL UNIQUE REFERENCES trainers(id) ON DELETE CASCADE,
  body        text NOT NULL,
  author      text NOT NULL CHECK (author IN ('AI', '人間', '対話')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE course_notes (
  id          bigserial PRIMARY KEY,
  course_id   bigint NOT NULL UNIQUE REFERENCES courses(id) ON DELETE CASCADE,
  body        text NOT NULL,
  author      text NOT NULL CHECK (author IN ('AI', '人間', '対話')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- レース後の評価。予想時点の展開の見立ては race_predictions
CREATE TABLE race_notes (
  id          bigserial PRIMARY KEY,
  race_id     bigint NOT NULL UNIQUE REFERENCES races(id) ON DELETE CASCADE,
  body        text NOT NULL,
  author      text NOT NULL CHECK (author IN ('AI', '人間', '対話')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 予想
-- ---------------------------------------------------------------------------

-- 印のマスタ。記号と並び順がぶら下がるのでテーブルにしている
CREATE TABLE marks (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  symbol      text NOT NULL UNIQUE,
  sort_order  int  NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO marks (name, symbol, sort_order) VALUES
  ('本命', '◎', 1),
  ('対抗', '◯', 2),
  ('単穴', '▲', 3),
  ('連下', '△', 4),
  ('大穴', '☆', 5),
  ('消し', 'ー', 6);

CREATE TABLE ai_predictions (
  id            bigserial PRIMARY KEY,
  entry_id      bigint NOT NULL UNIQUE REFERENCES entries(id) ON DELETE CASCADE,
  -- 無印は null
  mark_id       bigint REFERENCES marks(id) ON DELETE RESTRICT,
  rationale     text,
  -- 枠順確定後に出した時刻
  predicted_at  timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE my_predictions (
  id            bigserial PRIMARY KEY,
  entry_id      bigint NOT NULL UNIQUE REFERENCES entries(id) ON DELETE CASCADE,
  mark_id       bigint REFERENCES marks(id) ON DELETE RESTRICT,
  rationale     text,
  predicted_at  timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- レースごとの展開予想。AI と人間が対話で考えるので1テーブル
CREATE TABLE race_predictions (
  id            bigserial PRIMARY KEY,
  race_id       bigint NOT NULL UNIQUE REFERENCES races(id) ON DELETE CASCADE,
  body          text NOT NULL,
  -- 人間のみは入らない
  author        text NOT NULL CHECK (author IN ('AI', '対話')),
  predicted_at  timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 購入
-- ---------------------------------------------------------------------------
-- 買い目は「列」だけで保存する。展開後の組み合わせは持たない。
-- combination_count と total_amount は expandBet の計算結果だけを入れる。

CREATE TABLE ai_bets (
  id                 bigserial PRIMARY KEY,
  -- WIN5 のときだけ null
  race_id            bigint REFERENCES races(id) ON DELETE RESTRICT,
  ticket_type        text NOT NULL CHECK (ticket_type IN (
                       '単勝', '複勝', '枠連', '馬連', '馬単', 'ワイド', '3連複', '3連単', 'WIN5')),
  -- 人間が読むためのラベル。計算には使わない
  bet_style          text NOT NULL CHECK (bet_style IN ('単点', 'ボックス', '流し', 'フォーメーション')),
  -- 馬単・3連単以外は false
  is_multi           boolean NOT NULL DEFAULT false,
  unit_amount        int NOT NULL CHECK (unit_amount > 0 AND unit_amount % 100 = 0),
  combination_count  int NOT NULL CHECK (combination_count > 0),
  total_amount       int NOT NULL CHECK (total_amount > 0),
  -- ここから下はレース後
  payout             int CHECK (payout >= 0),
  refund             int CHECK (refund >= 0),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ai_bets_race_required CHECK (ticket_type = 'WIN5' OR race_id IS NOT NULL),
  CONSTRAINT ai_bets_multi_only_ordered CHECK (
    is_multi = false OR ticket_type IN ('馬単', '3連単'))
);

CREATE INDEX ai_bets_race_id_idx ON ai_bets (race_id);

CREATE TABLE ai_bet_legs (
  id              bigserial PRIMARY KEY,
  ai_bet_id       bigint NOT NULL REFERENCES ai_bets(id) ON DELETE CASCADE,
  -- 何列目か。WIN5 は対象5レースの発走順で 1〜5
  leg_group       int NOT NULL CHECK (leg_group > 0),
  -- 枠連のときは null
  entry_id        bigint REFERENCES entries(id) ON DELETE RESTRICT,
  -- 枠連のときだけ
  bracket_number  int CHECK (bracket_number BETWEEN 1 AND 8),
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ai_bet_legs_one_target CHECK (num_nonnulls(entry_id, bracket_number) = 1),
  -- 片方が必ず null になるので、NULL を同じ値として扱わないと重複を弾けない
  CONSTRAINT ai_bet_legs_unique_target
    UNIQUE NULLS NOT DISTINCT (ai_bet_id, leg_group, entry_id, bracket_number)
);

CREATE TABLE my_bets (
  id                 bigserial PRIMARY KEY,
  race_id            bigint REFERENCES races(id) ON DELETE RESTRICT,
  ticket_type        text NOT NULL CHECK (ticket_type IN (
                       '単勝', '複勝', '枠連', '馬連', '馬単', 'ワイド', '3連複', '3連単', 'WIN5')),
  bet_style          text NOT NULL CHECK (bet_style IN ('単点', 'ボックス', '流し', 'フォーメーション')),
  is_multi           boolean NOT NULL DEFAULT false,
  unit_amount        int NOT NULL CHECK (unit_amount > 0 AND unit_amount % 100 = 0),
  combination_count  int NOT NULL CHECK (combination_count > 0),
  total_amount       int NOT NULL CHECK (total_amount > 0),
  payout             int CHECK (payout >= 0),
  refund             int CHECK (refund >= 0),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT my_bets_race_required CHECK (ticket_type = 'WIN5' OR race_id IS NOT NULL),
  CONSTRAINT my_bets_multi_only_ordered CHECK (
    is_multi = false OR ticket_type IN ('馬単', '3連単'))
);

CREATE INDEX my_bets_race_id_idx ON my_bets (race_id);

CREATE TABLE my_bet_legs (
  id              bigserial PRIMARY KEY,
  my_bet_id       bigint NOT NULL REFERENCES my_bets(id) ON DELETE CASCADE,
  leg_group       int NOT NULL CHECK (leg_group > 0),
  entry_id        bigint REFERENCES entries(id) ON DELETE RESTRICT,
  bracket_number  int CHECK (bracket_number BETWEEN 1 AND 8),
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT my_bet_legs_one_target CHECK (num_nonnulls(entry_id, bracket_number) = 1),
  CONSTRAINT my_bet_legs_unique_target
    UNIQUE NULLS NOT DISTINCT (my_bet_id, leg_group, entry_id, bracket_number)
);

-- ---------------------------------------------------------------------------
-- 閲覧権限
-- ---------------------------------------------------------------------------
-- Phase 1 では作るだけで参照しない。

CREATE TABLE users (
  id            bigserial PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  access_level  text NOT NULL CHECK (access_level IN ('owner', 'friend', 'member', 'public')),
  -- 画面判定には使わない。将来 note のメンバー一覧を洗い替えるときの目印
  grant_source  text NOT NULL CHECK (grant_source IN ('owner', 'manual', 'note')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- updated_at のトリガーを貼る
-- ---------------------------------------------------------------------------
-- ai_bet_legs / my_bet_legs は created_at しか持たないので対象外。

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'courses', 'jockeys', 'trainers', 'horses', 'races', 'entries',
    'entry_notes', 'horse_notes', 'pedigree_notes', 'jockey_notes',
    'trainer_notes', 'course_notes', 'race_notes',
    'marks', 'ai_predictions', 'my_predictions', 'race_predictions',
    'ai_bets', 'my_bets', 'users'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %1$I BEFORE UPDATE ON %2$I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t || '_set_updated_at', t
    );
  END LOOP;
END;
$$;
