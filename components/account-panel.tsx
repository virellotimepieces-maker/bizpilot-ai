"use client";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Bootstrap = {
  user: { email: string; name: string };
  workspace: { name: string } | null;
  error?: string;
};

export function AccountPanel() {
  const router = useRouter();
  const [data, setData] = useState<Bootstrap | null>(null);

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

  return (
    <div className="min-h-full">
      <SiteHeader signedIn />
      <main className="mx-auto max-w-2xl px-4 py-10">
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
      </main>
    </div>
  );
}
