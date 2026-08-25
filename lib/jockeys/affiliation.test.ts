import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AFFILIATIONS } from "../enums/index.ts";
import {
  AFFILIATION_GROUPS,
  AFFILIATION_GROUP_ORDER,
  affiliationGroup,
  affiliationGroupLabel,
  groupAffiliations,
} from "./affiliation.ts";

describe("affiliationGroup", () => {
  it("URL に入っている区分をそのまま使う", () => {
    assert.equal(affiliationGroup("jra"), "jra");
    assert.equal(affiliationGroup("local"), "local");
    assert.equal(affiliationGroup("overseas"), "overseas");
  });

  it("未指定は JRA 所属にする", () => {
    assert.equal(affiliationGroup(undefined), "jra");
  });

  it("知らない値は JRA 所属にする", () => {
    assert.equal(affiliationGroup(""), "jra");
    assert.equal(affiliationGroup("美浦"), "jra");
    assert.equal(affiliationGroup("JRA"), "jra");
    assert.equal(affiliationGroup("all"), "jra");
  });
});

describe("groupAffiliations", () => {
  it("JRA 所属は美浦と栗東の両方を含む", () => {
    assert.deepEqual(groupAffiliations("jra"), ["美浦", "栗東"]);
  });

  it("地方所属と海外はそれぞれ1つ", () => {
    assert.deepEqual(groupAffiliations("local"), ["地方"]);
    assert.deepEqual(groupAffiliations("overseas"), ["外国"]);
  });

  it("DB に入っていい値だけを返す", () => {
    for (const group of AFFILIATION_GROUP_ORDER) {
      for (const affiliation of groupAffiliations(group)) {
        assert.ok(AFFILIATIONS.includes(affiliation), `${affiliation} は DB に無い値`);
      }
    }
  });

  it("3つの区分で AFFILIATIONS を重複なく使い切る", () => {
    const all = AFFILIATION_GROUP_ORDER.flatMap((group) => [...groupAffiliations(group)]);

    assert.equal(new Set(all).size, all.length);
    assert.deepEqual([...all].sort(), [...AFFILIATIONS].sort());
  });
});

describe("affiliationGroupLabel", () => {
  it("画面に出す名前を返す", () => {
    assert.equal(affiliationGroupLabel("jra"), "JRA所属");
    assert.equal(affiliationGroupLabel("local"), "地方所属");
    assert.equal(affiliationGroupLabel("overseas"), "海外");
  });
});

describe("AFFILIATION_GROUP_ORDER", () => {
  it("区分を1つずつ、過不足なく並べる", () => {
    assert.deepEqual([...AFFILIATION_GROUP_ORDER].sort(), Object.keys(AFFILIATION_GROUPS).sort());
  });
});
