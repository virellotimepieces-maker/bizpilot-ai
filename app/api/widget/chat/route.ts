import { NextRequest, NextResponse } from "next/server";
import { generateCustomerReply } from "@/lib/ai/generate-customer-reply";
import { handleCalendarWidgetTurn } from "@/lib/calendar/booking";
import { getBillingStore } from "@/lib/billing/factory";
import { BillingService } from "@/lib/billing/service";
import type { BillingStore } from "@/lib/billing/store";
import { BillingError } from "@/lib/billing/types";
import { resolveConversationLanguage } from "@/lib/i18n/conversation-language";
import { localizeAssistantText } from "@/lib/i18n/localize";
import { jsonError } from "@/lib/http";
import { linkCatalogProductCards } from "@/lib/shopify/catalog";
import type { WebsiteReplySource } from "@/lib/website/types";

async function withCatalogCards<T extends { content?: string; sources?: WebsiteReplySource[] | null }>(
  store: BillingStore,
  widgetKey: string,
  rows: T[],
) {
  const workspace = await store.getWorkspaceByWidgetKey(widgetKey);
  if (!workspace) return rows;
  const products = (await store.listShopifyProducts(workspace.id)).filter(
    (row) => row.workspaceId === workspace.id,
  );
  if (!products.length) return rows;
  return rows.map((row) => ({
    ...row,
    sources: linkCatalogProductCards(row.sources, products, row.content ?? ""),
  }));
}

function cors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const widgetKey = request.nextUrl.searchParams.get("widgetKey")?.trim() ?? "";
    const visitorKey = request.nextUrl.searchParams.get("visitorKey")?.trim() ?? "";
    const conversationId = request.nextUrl.searchParams.get("conversationId")?.trim() || undefined;
    if (!widgetKey || !visitorKey) {
      throw new BillingError("Missing widget or visitor key.", "invalid");
    }
    const store = getBillingStore();
    const thread = await new BillingService(store).loadWidgetThread(
      widgetKey,
      visitorKey,
      conversationId,
    );
    const conversation = thread.conversation;
    const messages = await withCatalogCards(store, widgetKey, thread.messages);
    return cors(
      NextResponse.json({
        conversationId: conversation?.id ?? null,
        waitingOnHuman: conversation?.waitingOnHuman ?? false,
        messages,
        contact: conversation
          ? {
              name: conversation.visitorName,
              email: conversation.visitorEmail,
              phone: conversation.visitorPhone,
            }
          : null,
      }),
    );
  } catch (error) {
    return cors(jsonError(error, "Could not load the conversation."));
  }
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
      slotStart?: string;
      handoff?: boolean;
      contact?: { name?: string; email?: string; phone?: string };
    };
    const widgetKey = body.widgetKey?.trim();
    const question = body.question?.trim();
    if (!widgetKey) {
      throw new BillingError("Missing widget key.", "invalid");
    }
    const store = getBillingStore();
    const service = new BillingService(store);
    let conversationId = body.conversationId;
    const contact = body.contact;
    if (contact && (contact.name?.trim() || contact.email?.trim() || contact.phone?.trim())) {
      const saved = await service.saveWidgetVisitorContact({
        widgetKey,
        visitorKey: body.visitorKey?.trim() || "anonymous",
        conversationId,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
      });
      conversationId = saved.id;
      if (!question && !body.handoff) {
        return cors(
          NextResponse.json({
            conversationId: saved.id,
            waitingOnHuman: saved.waitingOnHuman,
            contactSaved: true,
            contact: {
              name: saved.visitorName,
              email: saved.visitorEmail,
              phone: saved.visitorPhone,
            },
          }),
        );
      }
    }
    if (body.handoff && conversationId) {
      const visitorKey = body.visitorKey?.trim() || "anonymous";
      const thread = await service.loadWidgetThread(widgetKey, visitorKey, conversationId);
      if (!thread.conversation) throw new BillingError("Conversation not found.", "not_found");
      const language = await rememberWidgetLanguage(
        store,
        widgetKey,
        visitorKey,
        thread.conversation.id,
        question ?? "",
      );
      const conversation = await service.handoffToHuman(widgetKey, thread.conversation.id);
      return cors(
        NextResponse.json({
          conversationId: conversation.id,
          waitingOnHuman: true,
          answer: await localizeAssistantText(
            "I’m looping in a teammate who can take it from here. AI replies are paused for this conversation.",
            language,
          ),
        }),
      );
    }
    if (!question) {
      throw new BillingError("Enter a question.", "invalid");
    }
    const calendarTurn = await handleCalendarWidgetTurn({
      store,
      widgetKey,
      visitorKey: body.visitorKey?.trim() || "anonymous",
      conversationId,
      question,
      slotStart: body.slotStart?.trim(),
    });
    if (calendarTurn) {
      return cors(NextResponse.json(calendarTurn));
    }
    try {
      const result = await service.generateCountedAiReply({
        widgetKey,
        visitorKey: body.visitorKey?.trim() || "anonymous",
        conversationId,
        question,
        generate: generateCustomerReply,
      });
      const [decorated] = await withCatalogCards(store, widgetKey, [
        { content: result.answer, sources: result.sources },
      ]);
      return cors(
        NextResponse.json({
          ...result,
          sources: decorated?.sources ?? result.sources,
          waitingOnHuman: result.waitingOnHuman ?? false,
        }),
      );
    } catch (error) {
      if (error instanceof BillingError && error.code === "limit") {
        const workspace = await store.getWorkspaceByWidgetKey(widgetKey);
        const handoff =
          workspace?.knowledge?.escalation.handoffMessage ||
          "I want to make sure you get a precise answer. I’m looping in a teammate who can take it from here.";
        const language = await rememberWidgetLanguage(
          store,
          widgetKey,
          body.visitorKey?.trim() || "anonymous",
          conversationId,
          question,
        );
        return cors(
          NextResponse.json(
            {
              error: error.message,
              code: "limit",
              answer: await localizeAssistantText(
                `This business has used its monthly AI reply allowance. ${handoff}`,
                language,
              ),
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

async function rememberWidgetLanguage(
  store: BillingStore,
  widgetKey: string,
  visitorKey: string,
  conversationId: string | undefined,
  question: string,
) {
  if (!conversationId) return resolveConversationLanguage("", question);
  const workspace = await store.getWorkspaceByWidgetKey(widgetKey);
  if (!workspace) return resolveConversationLanguage("", question);
  const conversation = await store.getConversationForVisitor(workspace.id, visitorKey, conversationId);
  const language = resolveConversationLanguage(conversation?.detectedLanguage ?? "", question);
  if (conversation && language !== conversation.detectedLanguage) {
    await store.updateConversation(conversation.id, workspace.id, { detectedLanguage: language });
  }
  return language;
}
