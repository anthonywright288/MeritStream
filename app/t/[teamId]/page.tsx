import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata = { title: "Public team view — MeritStream" };

/**
 * PRD 4.4 — shareable read-only transparency page. Contributors use it to
 * verify they were counted; no admin control is rendered and no secret is
 * referenced anywhere in this tree.
 */
export default async function PublicTeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10">
      <DashboardView teamId={teamId} readOnly />
    </main>
  );
}
