-- 外で見かけた話を、その場で1つ残す先を作る。
--
-- 根拠は docs/data-model.md のメモ。手順は docs/agent-design.md のメモの取り込み。
--
-- 理由: SNS などで見かけた話は、その場で残せなければ消える。残す場所が DB のどこにも無く、
-- Claude Code を開ける時まで人間が覚えているしかなかった。覚えていられる量しか入らない。
--
-- 評価8テーブルとも entry_comments とも別のものとして持つ。ここに入るのは評価でも発言の
-- 記録でもなく、まだ確かめていない材料。読んで裏を取ったあとに、宛先が決まる。
--
-- 対象への外部キーを持たない。宛先を決めるのは取り込む側の仕事で、入稿の時点では決まって
-- いない。入稿する人に分類させると、そこが手作業として固定される。
--
-- author を持たない。ここに入るのは、定義上すべて人間が書いたもの。
--
-- body に長さの上限を付けるのは entry_comments.summary と同じ理由で、見たものの本文をそのまま
-- 貼れないようにするため。docs/compliance.md の「残すのは要約・評価した内容」を、指示だけで
-- なく仕組みの側でも守る。
--
-- verification と outcome を分けるのは、前者が確かめた事実、後者がそこからの判断だから。
-- entry_comments が summary と interpretation を分けているのと同じ。
--
-- テーブル追加なので、decisions/0004 に従い Neon のブランチは切らない。

CREATE TABLE memos (
  id           bigserial                NOT NULL,
  body         text                     NOT NULL,
  source       text,
  status       text                     NOT NULL DEFAULT '未処理',
  verification text,
  outcome      text,
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  updated_at   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT memos_pkey PRIMARY KEY (id),
  CONSTRAINT memos_status_check CHECK ((status = ANY (ARRAY['未処理'::text, '取り込み済み'::text, '見送り'::text, '保留'::text]))),
  -- 本文の写しではなく、自分の言葉のメモを入れるための上限
  CONSTRAINT memos_body_length CHECK ((char_length(body) <= 400)),
  -- 空のメモを入れても取り込みようがない
  CONSTRAINT memos_body_not_blank CHECK ((btrim(body) <> ''::text))
);

-- 引く動線は「未処理と保留を古い順に」
CREATE INDEX memos_status_idx ON public.memos USING btree (status, created_at);

CREATE TRIGGER memos_set_updated_at
  BEFORE UPDATE ON public.memos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
