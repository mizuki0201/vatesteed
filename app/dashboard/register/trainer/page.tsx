import type { Metadata } from "next";
import { TrainerFields } from "@/components/screens/fact-fields";
import { PageShell } from "@/components/screens/page-shell";
import { RegisterForm } from "@/components/screens/register-form";
import { assertCan } from "@/lib/access";
import { registerTrainer } from "../actions";

export const metadata: Metadata = { title: "厩舎を登録する — Vatesteed" };

export default async function Page() {
  await assertCan("data.edit");

  return (
    <PageShell
      back={{ href: "/dashboard/register", label: "データを登録する" }}
      lead="同じ名前が既に登録されていれば、登録する前に知らせます。"
      title="厩舎を登録する"
    >
      <RegisterForm action={registerTrainer} confirmLabel="同じ名前の別の厩舎として登録する">
        <TrainerFields />
      </RegisterForm>
    </PageShell>
  );
}
