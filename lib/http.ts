import { NextResponse } from "next/server";
import { BillingError } from "@/lib/billing/types";

function looksLikeSecret(message: string) {
  return /ya29\.|1\/\/[0-9A-Za-z_-]{8,}|refresh_token|access_token|client_secret|GOOGLE_CLIENT_SECRET|AUTH_SECRET/i.test(
    message,
  );
}

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
                  : error.code === "conflict" || error.code === "reconnect"
                    ? 409
                    : 400;
    const message = looksLikeSecret(error.message) ? fallback : error.message;
    return NextResponse.json({ error: message, code: error.code }, { status });
  }
  const message = error instanceof Error ? error.message : fallback;
  if (looksLikeSecret(message)) {
    return NextResponse.json({ error: fallback, code: "invalid" }, { status: 500 });
  }
  if (message.includes("not configured") || message.includes("DATABASE_URL") || message.includes("AUTH_SECRET")) {
    return NextResponse.json(
      { error: message.includes("AUTH_SECRET") ? "Paid platform is not configured." : message, code: "misconfigured" },
      { status: 503 },
    );
  }
  console.error("request_failed");
  return NextResponse.json({ error: fallback, code: "invalid" }, { status: 500 });
}
