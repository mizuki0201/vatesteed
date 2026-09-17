import type { Metadata } from "next";
import { JockeyFields } from "@/components/screens/fact-fields";
import { PageShell } from "@/components/screens/page-shell";
import { RegisterForm } from "@/components/screens/register-form";
import { assertCan } from "@/lib/access";
import { registerJockey } from "../actions";

export const metadata: Metadata = { title: "騎手を登録する — Vatesteed" };

export default async function Page() {
  await assertCan("data.edit");

  return (
    <PageShell
      back={{ href: "/dashboard/register", label: "データを登録する" }}
      lead="同じ名前が既に登録されていれば、登録する前に知らせます。"
      title="騎手を登録する"
    >
      <RegisterForm action={registerJockey} confirmLabel="同じ名前の別の騎手として登録する">
        <JockeyFields />
      </RegisterForm>
    </PageShell>
  );
}
