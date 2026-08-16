-- 確定払戻を残す先を作り、entries に着差を足す。
--
-- 根拠は docs/data-model.md の race_payouts と entries。
--
-- 理由: レースの画面に、AI が読んだ内容だけでなく**普通の出馬表・着順・確定払戻**を出すと
-- 決めた。着順は entries に列があるので出せるが、確定払戻を入れる先がどこにも無かった。
-- ai_bets.payout は「自分の買い目がいくら戻ったか」であって、レースの公式な払戻ではない。
-- 回収率の計算を検算するときにも、公式の払戻が要る。
--
-- 着差は結果表に必ず並ぶ項目だが、走破時計から機械的には出せない。JRA は「クビ」「ハナ」
-- 「1.1/2」のような文字で公表するので、そのまま文字で持つ。
--
-- 券種に WIN5 を含めない。WIN5 は5レースをまたぐもので、1つのレースの払戻ではない。

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
  -- 同着があると同じ券種で複数行になるので、組み合わせまで込みで一意にする
  CONSTRAINT race_payouts_natural_key UNIQUE (race_id, ticket_type, combination),
  CONSTRAINT race_payouts_amount_check CHECK ((amount > 0)),
  CONSTRAINT race_payouts_popularity_check CHECK ((popularity > 0)),
  CONSTRAINT race_payouts_ticket_type_check CHECK ((ticket_type = ANY (ARRAY['単勝'::text, '複勝'::text, '枠連'::text, '馬連'::text, '馬単'::text, 'ワイド'::text, '3連複'::text, '3連単'::text])))
);

ALTER TABLE race_payouts
  ADD CONSTRAINT race_payouts_race_id_fkey FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE;

CREATE INDEX race_payouts_race_id_idx ON public.race_payouts USING btree (race_id);

CREATE TRIGGER race_payouts_set_updated_at
  BEFORE UPDATE ON public.race_payouts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 着差。1着は空のまま（先頭に着差は無い）。
ALTER TABLE entries ADD COLUMN margin text;
