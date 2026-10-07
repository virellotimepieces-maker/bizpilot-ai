import type { ResolvingMetadata } from "next";
import { ProductLaunch } from "@/components/product-launch";
import { productPageGenerateMetadata } from "@/lib/marketing/product-page";

export function generateMetadata(_props: unknown, parent: ResolvingMetadata) {
  return productPageGenerateMetadata(parent);
}

export default function ProductPage() {
  return <ProductLaunch />;
}
