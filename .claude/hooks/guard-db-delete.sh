#!/bin/sh
# pnpm db:query から DELETE が流れるのを、人間の確認の手前で止める。
#
# 背景: lib/db/query.ts は CREATE / ALTER / DROP などスキーマを変える文だけを弾いていて、
# DELETE と UPDATE は意図的に通している（最初の1レースを手で入れ直す作業に要るため）。
# 一方 .env.local は本番の DB を指していて、この入口は確認を挟まずに役へ配られる。
# AGENTS.md と docs/development.md は「消す操作は必ず手前で確認する」を決めているので、
# その1点だけをここで機械的に担保する。UPDATE と SELECT は素通しする。
#
# ai_bets は一意制約が無く、消さずに書き直すと合計金額が二重になって回収率が壊れる
# （agent/skills/plan-bets/SKILL.md）。消す必要がある場面は実際にあるので、
# ここでは「エージェントが自分で流すのを止める」だけにして、人間が自分で叩く道は塞がない。
#
# jq が入っていない環境なので、判定は grep で行う（AGENTS.md の「環境」を参照）。

input=$(cat)

# db:query の呼び出し以外は何もしない。
case "$input" in
  *db:query*) ;;
  *) exit 0 ;;
esac

# インラインの SQL と、--file で渡された .sql の中身の両方を見る。
sql="$input"
for path in $(printf '%s' "$input" | grep -oE '\-\-file +[^ "\\]+' | sed 's/--file *//'); do
  if [ -f "$path" ]; then
    sql="$sql
$(cat "$path")"
  fi
done

if printf '%s' "$sql" | grep -qiE '(^|[^A-Za-z_])DELETE +FROM'; then
  echo "DELETE を含む db:query は自動では流しません（AGENTS.md「消す操作は必ず手前で確認する」）。" >&2
  echo "消してよいことを人間に確認したうえで、人間の手でコマンドを実行してください。" >&2
  echo "ai_bets を消すときは ai_bet_legs が先です（entry_id が RESTRICT のため）。" >&2
  exit 2
fi

exit 0
