import { TeamForm } from "@/components/create/team-form";

export const metadata = { title: "Create team — MeritStream" };

export default function CreatePage() {
  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto mb-6 max-w-xl">
        <p className="font-mono text-[11px] font-semibold tracking-[0.12em] text-(--fg-accent) uppercase">
          New team
        </p>
        <h1 className="font-heading mt-1 text-3xl font-bold tracking-tight">
          Set the formula once. Settle forever.
        </h1>
        <p className="mt-2 text-sm text-(--fg-secondary)">
          Name the repo, agree the weights, list the wallets. Everything else
          runs on schedule.
        </p>
      </div>
      <TeamForm />
    </main>
  );
}
