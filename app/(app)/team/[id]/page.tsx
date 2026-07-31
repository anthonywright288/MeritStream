import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata = { title: "Team dashboard — MeritStream" };

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10">
      <DashboardView teamId={id} />
    </main>
  );
}
