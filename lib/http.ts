import { NextResponse } from "next/server";
import { BillingError } from "@/lib/billing/types";

export function jsonError(error: unknown, fallback = "Something went wrong.") {
  if (error instanceof BillingError) {
    const status =
      error.code === "unauthorized"
        ? 401
        : error.code === "forbidden"
          ? 403
          : error.code === "not_found"
            ? 404
            : error.code === "inactive"
              ? 402
              : error.code === "limit"
                ? 429
                : error.code === "misconfigured"
                  ? 503
                  : error.code === "conflict"
                    ? 409
                    : 400;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  const message = error instanceof Error ? error.message : fallback;
  if (message.includes("not configured") || message.includes("DATABASE_URL") || message.includes("AUTH_SECRET")) {
    return NextResponse.json(
      { error: message, code: "misconfigured" },
      { status: 503 },
    );
  }
  console.error(error);
  return NextResponse.json({ error: fallback, code: "invalid" }, { status: 500 });
}
