"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PublicSocialAccount } from "@/lib/social/public";
import { HELPER_TEXT_CLASS } from "@/lib/ui/type-scale";
import { useState } from "react";

function connectionLabel(account: PublicSocialAccount) {
  if (account.connection === "connected") return "Connected";
  if (account.connection === "needs_reconnect") return "Needs reconnect";
  if (account.connection === "pending_selection") return "Choose an account";
  if (account.connection === "setup_required") return "Setup required";
  return "Not connected";
}

export function SocialAccounts({
  accounts,
  onChanged,
}: {
  accounts: PublicSocialAccount[];
  onChanged: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [choice, setChoice] = useState<Record<string, string>>({});

  async function disconnect(platform: string) {
    setBusy(platform);
    setNotice("");
    const response = await fetch(`/api/app/social/accounts/${platform}/disconnect`, { method: "POST" });
    const payload = (await response.json()) as { error?: string };
    setBusy("");
    if (!response.ok) {
      setNotice(payload.error || "Could not disconnect that account.");
      return;
    }
    setNotice("Social account disconnected and stored credentials were deleted.");
    await onChanged();
  }

  async function selectDestination(platform: string) {
    const destinationId = choice[platform];
    if (!destinationId) return;
    setBusy(platform);
    setNotice("");
    const response = await fetch(`/api/app/social/accounts/${platform}/select`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ destinationId }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusy("");
    if (!response.ok) {
      setNotice(payload.error || "Could not save that destination.");
      return;
    }
    setNotice("Destination saved for this workspace.");
    await onChanged();
  }

  return (
    <div className="grid gap-3">
      {notice ? <p className={HELPER_TEXT_CLASS}>{notice}</p> : null}
      {accounts.map((account) => {
        const canConnect = account.configured && account.connection !== "pending_selection";
        const showDisconnect =
          account.connection === "connected" ||
          account.connection === "needs_reconnect" ||
          account.connection === "pending_selection";
        return (
          <div key={account.platform} className="grid gap-2 rounded-xl border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{account.label}</p>
                {account.accountName ? (
                  <p className={`text-sm text-muted-foreground ${HELPER_TEXT_CLASS}`}>{account.accountName}</p>
                ) : null}
              </div>
              <Badge variant={account.connection === "connected" ? "default" : "outline"}>
                {connectionLabel(account)}
              </Badge>
            </div>
            {account.connection === "setup_required" ? (
              <div className={`grid gap-1 text-sm text-muted-foreground ${HELPER_TEXT_CLASS}`}>
                <p>Missing: {account.missing.join(", ")}</p>
                <ul className="list-disc pl-4">
                  {account.setupNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {account.connection === "pending_selection" ? (
              <div className="grid gap-2">
                <Label htmlFor={`social-destination-${account.platform}`}>Authorized destination</Label>
                <Select
                  value={choice[account.platform] || ""}
                  onValueChange={(value) =>
                    setChoice((prev) => ({ ...prev, [account.platform]: value ?? "" }))
                  }
                >
                  <SelectTrigger id={`social-destination-${account.platform}`} className="w-full">
                    <SelectValue placeholder="Choose a page or account" />
                  </SelectTrigger>
                  <SelectContent>
                    {account.destinations.map((destination) => (
                      <SelectItem key={destination.id} value={destination.id}>
                        {destination.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  disabled={busy === account.platform || !choice[account.platform]}
                  onClick={() => void selectDestination(account.platform)}
                >
                  Use this account
                </Button>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {canConnect && account.connection !== "connected" ? (
                <Button
                  size="sm"
                  render={
                    <a href={`/api/app/social/connect/${account.platform}?returnTo=/app/integrations`} />
                  }
                >
                  {account.connection === "needs_reconnect" ? "Reconnect" : "Connect"}
                </Button>
              ) : null}
              {account.connection === "connected" ? (
                <Button
                  size="sm"
                  variant="outline"
                  render={<a href={`/api/app/social/connect/${account.platform}?returnTo=/app/integrations`} />}
                >
                  Reconnect
                </Button>
              ) : null}
              {showDisconnect ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === account.platform}
                  onClick={() => void disconnect(account.platform)}
                >
                  Disconnect
                </Button>
              ) : null}
            </div>
            <p className={HELPER_TEXT_CLASS}>Copy stays available for this platform.</p>
          </div>
        );
      })}
    </div>
  );
}
