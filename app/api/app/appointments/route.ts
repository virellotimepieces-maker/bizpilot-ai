import { NextRequest, NextResponse } from "next/server";
import { BillingService } from "@/lib/billing/service";
import { jsonError } from "@/lib/http";
import { requirePaidKnowledgeContext } from "@/lib/v2/knowledge-access";
import { serializeAppointmentRequest } from "@/lib/v2/appointments";

export async function GET(request: NextRequest) {
  try {
    const { store, workspace } = await requirePaidKnowledgeContext();
    const status = request.nextUrl.searchParams.get("status");
    const query = request.nextUrl.searchParams.get("query");
    const appointments = await new BillingService(store).listWorkspaceAppointmentRequests(
      workspace.id,
      { status, query },
    );
    return NextResponse.json({ appointments: appointments.map(serializeAppointmentRequest) });
  } catch (error) {
    return jsonError(error, "Could not load appointment requests.");
  }
}
