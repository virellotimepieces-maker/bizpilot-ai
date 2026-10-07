import type { ResolvingMetadata } from "next";
import { AboutBizlyro } from "@/components/about-bizlyro";
import { aboutPageGenerateMetadata } from "@/lib/marketing/about-page";

export function generateMetadata(_props: unknown, parent: ResolvingMetadata) {
  return aboutPageGenerateMetadata(parent);
}

export default function AboutPage() {
  return <AboutBizlyro />;
}
