-- レースの区間ごとのラップと、予想時点で分かっていた馬場・天候の前提を残す先を作る。
--
-- 根拠は docs/data-model.md の race_laps と race_prediction_conditions。
--
-- ラップの理由: 走破時計と上がり3Fだけでは、前半が速かったのか、途中のどこで流れが変わったのかを
-- 強くは言えない。それでもペースの評価は書けてしまうので、もっともらしい推測がそのまま
-- entry_notes と race_notes の土台になる。区間ごとの数字を持てば、そこを根拠のある話にできる。
--
-- 区間の本数を固定しない。2000m なら200mずつで10区間になるが、距離や取得元の都合で区間の数も
-- 長さも変わる。距離を行ごとに持ち、順序は lap_number で持つ。
--
-- 取れなかった区間を0で埋めないために、time_ms は正の数だけを通す。行が無い区間も、time_ms が
-- null の区間も「取れなかった」であって「0秒」ではない。
--
-- 前提の理由: 予想は枠順が確定した金曜か土曜に作り、日曜のレース前に出す。そのとき分かって
-- いたのはコース区分・開催の進み具合・予報までで、実際の馬場は日曜にならないと確定しない。
-- 同じ列を上書きする形にすると、公開した予想を当日の情報で書き換えたのと区別が付かなくなる。
-- races.track_condition と races.weather はレース後の実績のまま残し、予想時点のものは別の
-- テーブルに置く。
--
-- track_division だけ列にしてあるのは、レースをまたいで揃えて見たいのがここだから。それ以外の
-- 前提（予報、馬場の見込み、公表済みの数値、取れなかったもの）は body に文章で書く。開催の
-- 進み具合は races.meeting_number と meeting_day にあるので重ねて持たない。
--
-- どちらもテーブル追加なので、decisions/0004 に従い Neon のブランチは切らない。

CREATE TABLE race_laps (
  id          bigserial                NOT NULL,
  race_id     bigint                   NOT NULL,
  lap_number  integer                  NOT NULL,
  distance_m  integer                  NOT NULL,
  time_ms     integer,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT race_laps_pkey PRIMARY KEY (id),
  -- 同じ区間の二重登録を塞ぐ。race_id はこの先頭列で引けるので索引は別に張らない
  CONSTRAINT race_laps_natural_key UNIQUE (race_id, lap_number),
  CONSTRAINT race_laps_lap_number_check CHECK ((lap_number > 0)),
  CONSTRAINT race_laps_distance_m_check CHECK ((distance_m > 0)),
  -- 0 を入れさせない。取れなかった区間は null か、行を作らない
  CONSTRAINT race_laps_time_ms_check CHECK ((time_ms > 0))
);

ALTER TABLE race_laps
  ADD CONSTRAINT race_laps_race_id_fkey FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE;

CREATE TRIGGER race_laps_set_updated_at
  BEFORE UPDATE ON public.race_laps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE race_prediction_conditions (
  id             bigserial                NOT NULL,
  race_id        bigint                   NOT NULL,
  predicted_at   timestamp with time zone NOT NULL,
  track_division text,
  body           text                     NOT NULL,
  author         text                     NOT NULL,
  created_at     timestamp with time zone NOT NULL DEFAULT now(),
  updated_at     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT race_prediction_conditions_pkey PRIMARY KEY (id),
  CONSTRAINT race_prediction_conditions_race_id_key UNIQUE (race_id),
  CONSTRAINT race_prediction_conditions_author_check CHECK ((author = ANY (ARRAY['AI'::text, '人間'::text, '対話'::text])))
);

ALTER TABLE race_prediction_conditions
  ADD CONSTRAINT race_prediction_conditions_race_id_fkey FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE;

CREATE TRIGGER race_prediction_conditions_set_updated_at
  BEFORE UPDATE ON public.race_prediction_conditions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
