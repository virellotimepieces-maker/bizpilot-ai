import { LoginForm } from "@/components/login-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://bizlyro.com/login" },
};

export default function LoginPage() {
  return <LoginForm />;
}
