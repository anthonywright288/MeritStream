import Link from "next/link";

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
      {/* Minimal brand row — public page keeps zero app/admin chrome */}
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2.5 text-[15px] font-bold tracking-tight text-(--fg-primary)"
      >
        <span
          aria-hidden
          className="inline-block size-2.5 rounded-full bg-indigo-500 shadow-[0_0_14px_var(--accent-glow)]"
        />
        MeritStream
        <span className="rounded-full border border-(--border-success) bg-(--surface-success) px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.12em] text-(--fg-success) uppercase">
          public · read-only
        </span>
      </Link>
      <DashboardView teamId={teamId} readOnly />
    </main>
  );
}
