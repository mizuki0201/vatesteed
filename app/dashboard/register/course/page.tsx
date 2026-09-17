import type { Metadata } from "next";
import { CourseFields } from "@/components/screens/fact-fields";
import { PageShell } from "@/components/screens/page-shell";
import { RegisterForm } from "@/components/screens/register-form";
import { listTracks } from "@/lib/facts";
import { registerCourse } from "../actions";

export const metadata: Metadata = { title: "コースを登録する — Vatesteed" };

export default async function Page() {
  const tracks = await listTracks();

  return (
    <PageShell back={{ href: "/dashboard/register", label: "データを登録する" }} title="コースを登録する">
      <RegisterForm action={registerCourse}>
        <CourseFields tracks={tracks} />
      </RegisterForm>
    </PageShell>
  );
}
