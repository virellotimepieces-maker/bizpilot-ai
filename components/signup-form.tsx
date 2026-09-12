"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { PasswordInput } from "@/components/password-input";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const PASSWORD_MISMATCH_ERROR = "Passwords do not match.";

export function SignupForm() {
  const router = useRouter();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mismatchError, setMismatchError] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function updatePassword(nextPassword: string) {
    setPassword(nextPassword);
    if (mismatchError && nextPassword === confirmPassword) {
      setMismatchError("");
    }
  }

  function updateConfirmPassword(nextConfirmPassword: string) {
    setConfirmPassword(nextConfirmPassword);
    if (mismatchError && password === nextConfirmPassword) {
      setMismatchError("");
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setMismatchError(PASSWORD_MISMATCH_ERROR);
      setError("");
      return;
    }
    setPending(true);
    setError("");
    setMismatchError("");
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, businessName, email, password }),
    });
    const payload = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error || "Could not create the account.");
      return;
    }
    router.push("/billing");
  }

  return (
    <div className="min-h-full">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-12">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Create your BizPilot account</CardTitle>
            <CardDescription>
              One business workspace is created with your account. Subscribe to BizPilot Pro to
              unlock the dashboard and website widget.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form className="grid gap-4" onSubmit={onSubmit}>
              <Field label="Your name">
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
              <Field label="Business name">
                <Input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
              <Field label="Password" hint="At least 8 characters." htmlFor={passwordId}>
                <PasswordInput
                  id={passwordId}
                  value={password}
                  onChange={updatePassword}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </Field>
              <Field
                label="Confirm password"
                htmlFor={confirmPasswordId}
                error={mismatchError}
              >
                <PasswordInput
                  id={confirmPasswordId}
                  value={confirmPassword}
                  onChange={updateConfirmPassword}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  invalid={Boolean(mismatchError)}
                  describedBy={mismatchError ? `${confirmPasswordId}-error` : undefined}
                />
              </Field>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create account"}
              </Button>
            </form>
            <p className="mt-4 text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link className="underline" href="/login">
                Sign in
              </Link>
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Creating an account means you agree to the{" "}
              <Link className="underline" href="/terms">
                Terms
              </Link>{" "}
              and{" "}
              <Link className="underline" href="/privacy">
                Privacy Policy
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
