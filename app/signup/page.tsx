import { SignupForm } from "@/components/signup-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://bizlyro.com/signup" },
};

export default function SignupPage() {
  return <SignupForm />;
}
