import { NextRequest, NextResponse } from "next/server";
import { BillingService } from "@/lib/billing/service";
import { jsonError } from "@/lib/http";
import { requirePaidKnowledgeContext } from "@/lib/v2/knowledge-access";
import { parseAppointmentPatch, serializeAppointmentRequest } from "@/lib/v2/appointments";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { store, workspace } = await requirePaidKnowledgeContext();
    const patch = parseAppointmentPatch(await request.json());
    const appointment = await new BillingService(store).updateWorkspaceAppointmentRequest(
      workspace.id,
      id,
      patch,
    );
    return NextResponse.json({ appointment: serializeAppointmentRequest(appointment) });
  } catch (error) {
    return jsonError(error, "Could not update the appointment request.");
  }
}
