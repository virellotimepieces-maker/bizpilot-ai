"use client";

import { Field } from "@/components/field";
import { PasswordInput } from "@/components/password-input";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

type Bootstrap = {
  user: { email: string; name: string };
  workspace: { name: string } | null;
  error?: string;
};

export function AccountPanel() {
  const router = useRouter();
  const currentId = useId();
  const nextId = useId();
  const [data, setData] = useState<Bootstrap | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    void fetch("/api/app/bootstrap")
      .then((response) => response.json())
      .then(setData);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setPasswordError("");
    const response = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const payload = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setPasswordError(payload.error || "Could not change the password.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    toast.success("Password updated");
  }

  return (
    <div className="min-h-full">
      <SiteHeader signedIn />
      <main className="mx-auto grid max-w-2xl gap-6 px-4 py-10">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Account</CardTitle>
            <CardDescription>This page stays available even if billing is inactive.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 pt-4 text-sm">
            <p>Name: {data?.user?.name ?? "…"}</p>
            <p>Email: {data?.user?.email ?? "…"}</p>
            <p>Workspace: {data?.workspace?.name ?? "…"}</p>
            <Button variant="outline" onClick={logout} className="w-fit">
              Sign out
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Change password</CardTitle>
            <CardDescription>
              There is no reset email. You must know the current password. New passwords need at
              least 8 characters.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form className="grid gap-4" onSubmit={changePassword}>
              <Field label="Current password">
                <PasswordInput
                  id={currentId}
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  required
                  autoComplete="current-password"
                />
              </Field>
              <Field label="New password">
                <PasswordInput
                  id={nextId}
                  value={newPassword}
                  onChange={setNewPassword}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </Field>
              {passwordError ? <p className="text-sm text-destructive">{passwordError}</p> : null}
              <Button type="submit" disabled={pending} className="w-fit">
                {pending ? "Saving…" : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-sm text-muted-foreground">
          <Link className="underline" href="/privacy">
            Privacy
          </Link>
          {" · "}
          <Link className="underline" href="/terms">
            Terms
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
