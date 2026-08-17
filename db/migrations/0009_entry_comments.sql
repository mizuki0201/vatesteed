-- 騎手と陣営が述べたことを、発言のたびに1行ずつ残す先を作る。
--
-- 根拠は docs/data-model.md のコメント。
--
-- 理由: コンセプトも構成も、コメントを長期に蓄積する前提で書いてあるのに、保存する場所が
-- どこにも無かった。役を呼ぶときのメッセージで渡すか、評価の本文に混ぜるしかなく、
-- 誰が・いつ・レースの前後どちらで・何を述べたかが失われる。これでは、同じ言い回しの
-- 繰り返しや、レース前後での説明の変化を後から比べられない。
--
-- 評価8テーブルとは別のものとして持つ。あちらは読んだ結果の評価で、1対象1行の上書き。
-- こちらは発言の記録で、出走1つに何行でも時系列で溜まる。混ぜると、発言の時点が消える。
--
-- 対象を出走にするのは、コメントが「どの馬の、どのレースについて」の話になるため。
-- entries は馬とレースの両方を持つので、そのまま対象になる。レース前後の別も、レースが
-- 決まって初めて意味を持つ。引き受ける制約は、登録していない出走についての発言を残せないこと。
--
-- 発言者に外部キーを張らない。調教助手と厩務員は jockeys にも trainers にも居ないうえ、
-- 騎手のコメントもその出走に乗った騎手のものとは限らない（乗り替わりの前の騎手が述べる
-- ことがある）。FK にすると、この2つがどちらも入らなくなる。
--
-- 一意制約は張らない。同じ人が同じ日に別のことを述べることがあるので、機械的な自然キーが
-- 決まらない。二重登録は、登録の前に同じ出走・同じ時点・同じ発言者を探す手順で防ぐ
-- （horses や jockeys を名前で探してから作るのと同じ形）。
--
-- summary に長さの上限を付けるのは、取得したページの本文をそのまま貼れないようにするため。
-- docs/compliance.md の「残すのは要約・評価した内容」を、指示だけでなく仕組みの側でも守る。
--
-- テーブル追加なので、decisions/0004 に従い Neon のブランチは切らない。

CREATE TABLE entry_comments (
  id             bigserial                NOT NULL,
  entry_id       bigint                   NOT NULL,
  race_phase     text                     NOT NULL,
  speaker_role   text                     NOT NULL,
  speaker_name   text,
  spoken_on      date,
  summary        text                     NOT NULL,
  interpretation text,
  source         text,
  author         text                     NOT NULL,
  created_at     timestamp with time zone NOT NULL DEFAULT now(),
  updated_at     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT entry_comments_pkey PRIMARY KEY (id),
  CONSTRAINT entry_comments_race_phase_check CHECK ((race_phase = ANY (ARRAY['レース前'::text, 'レース後'::text]))),
  CONSTRAINT entry_comments_speaker_role_check CHECK ((speaker_role = ANY (ARRAY['騎手'::text, '調教師'::text, '調教助手'::text, '厩務員'::text, '馬主'::text, '生産者'::text, 'その他'::text]))),
  CONSTRAINT entry_comments_author_check CHECK ((author = ANY (ARRAY['AI'::text, '人間'::text, '対話'::text]))),
  -- 本文の写しではなく要約を入れるための上限。長さで縛れるのはここだけなので、ここで縛る
  CONSTRAINT entry_comments_summary_length CHECK ((char_length(summary) <= 400))
);

ALTER TABLE entry_comments
  ADD CONSTRAINT entry_comments_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE;

-- 引く動線は「この出走のコメント」。一意制約が無いので、索引を兼ねるものが他に無い
CREATE INDEX entry_comments_entry_id_idx ON public.entry_comments USING btree (entry_id);

CREATE TRIGGER entry_comments_set_updated_at
  BEFORE UPDATE ON public.entry_comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
