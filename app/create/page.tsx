import { TeamForm } from "@/components/create/team-form";

export const metadata = { title: "Create team — MeritStream" };

export default function CreatePage() {
  return (
    <main className="min-h-screen px-4 py-10">
      <TeamForm />
    </main>
  );
}
