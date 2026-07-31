"use client";

import { useState } from "react";
import { isAddress } from "viem";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MemberRow, type MemberInput } from "@/components/create/member-row";
import { CreateSuccess, type CreateResult } from "@/components/create/create-success";

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

export function TeamForm() {
  const [name, setName] = useState("");
  const [repo, setRepo] = useState("");
  const [commitWeight, setCommitWeight] = useState("1");
  const [prWeight, setPrWeight] = useState("3");
  const [cycle, setCycle] = useState<"weekly" | "monthly">("weekly");
  const [members, setMembers] = useState<MemberInput[]>([
    { githubUsername: "", walletAddress: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);

  if (result) return <CreateSuccess result={result} />;

  // Mirrors the server rules ([RT-M1]); server stays authoritative
  const clientValidate = (): string | null => {
    if (!name.trim()) return "Team name is required";
    if (!REPO_RE.test(repo)) return "Repo must be owner/name";
    const cw = Number(commitWeight);
    const pw = Number(prWeight);
    if (!Number.isInteger(cw) || cw < 0 || !Number.isInteger(pw) || pw < 0) {
      return "Weights must be non-negative integers";
    }
    if (cw === 0 && pw === 0) return "Weights cannot both be zero";
    if (!members.length) return "Add at least one member";
    const names = members.map((m) => m.githubUsername.trim().toLowerCase());
    if (names.some((n) => !n)) return "Every member needs a GitHub username";
    if (new Set(names).size !== names.length) return "Duplicate GitHub usernames";
    for (const m of members) {
      if (!isAddress(m.walletAddress)) {
        return `Invalid wallet address for ${m.githubUsername || "a member"}`;
      }
    }
    return null;
  };

  const submit = async () => {
    const problem = clientValidate();
    if (problem) return setError(problem);
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          repo: repo.trim(),
          leadAddress: "0x0",
          commitWeight: Number(commitWeight),
          prWeight: Number(prWeight),
          cycle,
          members: members.map((m) => ({
            githubUsername: m.githubUsername.trim(),
            walletAddress: m.walletAddress.trim(),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "create failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>Create team</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="name">Team name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="repo">GitHub repo (owner/name, public)</Label>
          <Input id="repo" placeholder="vercel/next.js" value={repo} onChange={(e) => setRepo(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label htmlFor="cw">Commit points</Label>
            <Input id="cw" type="number" min={0} step={1} value={commitWeight} onChange={(e) => setCommitWeight(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pw">Merged PR points</Label>
            <Input id="pw" type="number" min={0} step={1} value={prWeight} onChange={(e) => setPrWeight(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cycle">Cycle</Label>
            <select
              id="cycle"
              // matches the Input primitive: surface-strong glass, 8px radius, 44px tall
              className="h-11 w-full rounded-(--radius-control) border border-input bg-(--surface-strong) px-3 text-sm shadow-[inset_0_1px_0_#ffffffe6] transition-[border-color,box-shadow] duration-(--dur-fast) outline-none focus-visible:border-(--focus-ring) focus-visible:ring-4 focus-visible:ring-[#5157d81f]"
              value={cycle}
              onChange={(e) => setCycle(e.target.value as "weekly" | "monthly")}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Members (GitHub username + wallet)</Label>
          {members.map((m, i) => (
            <MemberRow
              key={i}
              value={m}
              removable={members.length > 1}
              onChange={(next) => setMembers(members.map((x, j) => (j === i ? next : x)))}
              onRemove={() => setMembers(members.filter((_, j) => j !== i))}
            />
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setMembers([...members, { githubUsername: "", walletAddress: "" }])}>
            + Add member
          </Button>
        </div>
        {error && (
          <p className="rounded-(--radius-control) border border-(--border-danger) bg-(--surface-danger) px-3 py-2 text-sm text-(--fg-danger)">
            {error}
          </p>
        )}
        <Button className="w-full" onClick={submit} disabled={submitting}>
          {submitting ? "Creating… (validating repo & members)" : "Create team"}
        </Button>
      </CardContent>
    </Card>
  );
}
