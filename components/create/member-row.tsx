"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface MemberInput {
  githubUsername: string;
  walletAddress: string;
}

export function MemberRow({
  value,
  onChange,
  onRemove,
  removable,
}: {
  value: MemberInput;
  onChange: (next: MemberInput) => void;
  onRemove: () => void;
  removable: boolean;
}) {
  return (
    <div className="flex gap-2">
      <Input
        placeholder="github username"
        value={value.githubUsername}
        onChange={(e) => onChange({ ...value, githubUsername: e.target.value })}
      />
      <Input
        placeholder="wallet 0x…"
        className="font-mono"
        value={value.walletAddress}
        onChange={(e) => onChange({ ...value, walletAddress: e.target.value })}
      />
      <Button type="button" variant="outline" onClick={onRemove} disabled={!removable}>
        ✕
      </Button>
    </div>
  );
}
