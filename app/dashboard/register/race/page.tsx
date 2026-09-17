import type { Metadata } from "next";
import { RaceFields } from "@/components/screens/fact-fields";
import { PageShell } from "@/components/screens/page-shell";
import { RegisterForm } from "@/components/screens/register-form";
import { listCourseOptions } from "@/lib/facts";
import { registerRace } from "../actions";

export const metadata: Metadata = { title: "レースを登録する — Vatesteed" };

export default async function Page() {
  const courses = await listCourseOptions();

  return (
    <PageShell
      back={{ href: "/dashboard/register", label: "データを登録する" }}
      lead="同じ日付・同じコースのレースが既にあれば、登録する前に知らせます。登録したら出走の登録へ進みます。"
      title="レースを登録する"
    >
      <RegisterForm action={registerRace} confirmLabel="別のレースとして登録する">
        <RaceFields courses={courses} />
      </RegisterForm>
    </PageShell>
  );
}
