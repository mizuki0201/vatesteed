-- AI の買い目を、なぜその形にしたかを残す。
--
-- 根拠は docs/data-model.md の ai_bet_rationales と金額の割り方。組み方は docs/agent-design.md の
-- 「5. 買い目を組む」。
--
-- 理由: 買い目はレース当日の午前のオッズを見て組み、当たっても予算を下回る組み合わせを買わず、
-- どれが当たっても払戻がほぼ同じになるように金額を割ると決めた（2026-09-19）。振り返りで
-- その判断が合っていたかを確かめるには、いつ時点のオッズで、どの馬を買う理由のある馬として、
-- どう判定したかが残っていないといけない。
--
-- ai_bets の列にしない。金額が組み合わせごとに違うので ai_bets は1組み合わせ1行になることが
-- 多く、理由はレースごとのものなので、列にすると同じ文章が行の数だけ並ぶ。
--
-- race_id は ai_bets と同じく RESTRICT。買い目は回収率の元になる記録で、レースを消すときに
-- 黙って一緒に消えないようにする。
--
-- テーブル追加なので、decisions/0004 に従い Neon のブランチは切らない。

CREATE TABLE ai_bet_rationales (
  id              bigserial                NOT NULL,
  race_id         bigint                   NOT NULL,
  odds_checked_at timestamp with time zone NOT NULL,
  body            text                     NOT NULL,
  created_at      timestamp with time zone NOT NULL DEFAULT now(),
  updated_at      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_bet_rationales_pkey PRIMARY KEY (id),
  CONSTRAINT ai_bet_rationales_race_id_key UNIQUE (race_id),
  -- 理由の無い行を入れても、振り返りで確かめようがない
  CONSTRAINT ai_bet_rationales_body_not_blank CHECK ((btrim(body) <> ''::text))
);

ALTER TABLE ai_bet_rationales
  ADD CONSTRAINT ai_bet_rationales_race_id_fkey FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE RESTRICT;

CREATE TRIGGER ai_bet_rationales_set_updated_at
  BEFORE UPDATE ON public.ai_bet_rationales
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
