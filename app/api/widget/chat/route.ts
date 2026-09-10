import { NextRequest, NextResponse } from "next/server";
import { generateCustomerReply } from "@/lib/ai/generate-customer-reply";
import { getBillingStore } from "@/lib/billing/factory";
import { BillingService } from "@/lib/billing/service";
import { BillingError } from "@/lib/billing/types";
import { jsonError } from "@/lib/http";

function cors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      widgetKey?: string;
      visitorKey?: string;
      conversationId?: string;
      question?: string;
      handoff?: boolean;
    };
    const widgetKey = body.widgetKey?.trim();
    const question = body.question?.trim();
    if (!widgetKey) {
      throw new BillingError("Missing widget key.", "invalid");
    }
    const store = getBillingStore();
    const service = new BillingService(store);
    if (body.handoff && body.conversationId) {
      const conversation = await service.handoffToHuman(widgetKey, body.conversationId);
      return cors(
        NextResponse.json({
          conversationId: conversation.id,
          waitingOnHuman: true,
          answer:
            "I’m looping in a teammate who can take it from here. AI replies are paused for this conversation.",
        }),
      );
    }
    if (!question) {
      throw new BillingError("Enter a question.", "invalid");
    }
    try {
      const result = await service.generateCountedAiReply({
        widgetKey,
        visitorKey: body.visitorKey?.trim() || "anonymous",
        conversationId: body.conversationId,
        question,
        generate: generateCustomerReply,
      });
      return cors(NextResponse.json(result));
    } catch (error) {
      if (error instanceof BillingError && error.code === "limit") {
        const workspace = await store.getWorkspaceByWidgetKey(widgetKey);
        const handoff =
          workspace?.knowledge?.escalation.handoffMessage ||
          "I want to make sure you get a precise answer. I’m looping in a teammate who can take it from here.";
        return cors(
          NextResponse.json(
            {
              error: error.message,
              code: "limit",
              answer: `This business has used its monthly AI reply allowance. ${handoff}`,
              waitingOnHuman: true,
            },
            { status: 429 },
          ),
        );
      }
      throw error;
    }
  } catch (error) {
    const response = jsonError(error, "Could not answer from the widget.");
    return cors(response);
  }
}
