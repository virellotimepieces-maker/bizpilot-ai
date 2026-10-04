import { headers } from "next/headers";
import { publicOriginForHost } from "@/lib/public-origin";

export async function requestPublicOrigin() {
  const headerStore = await headers();
  return publicOriginForHost(headerStore.get("x-forwarded-host") ?? headerStore.get("host"));
}
