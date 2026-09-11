"use client";

import { Field } from "@/components/field";
import { SetupGate } from "@/components/setup-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { nid } from "@/lib/id";
import {
  formatClockTime,
  HOURS_DAY_ROW_CLASS,
  HOURS_TIME_FIELDS_CLASS,
  HOURS_TIME_INPUT_CLASS,
} from "@/lib/hours-display";
import {
  BUSINESS_TYPE_HINT,
  BUSINESS_TYPE_LABEL,
  DAY_LABEL,
  defaultOfferingKind,
  offeringKindLabel,
  offeringLabel,
  showsClinicOperations,
  showsServiceOperations,
  showsStoreOperations,
} from "@/lib/labels";
import type {
  BusinessType,
  FaqItem,
  KnowledgeBase,
  KnowledgeDocument,
  Offering,
  Policy,
} from "@/lib/types";
import { useWorkspace } from "@/lib/workspace-store";
import {
  HELPER_TEXT_CLASS,
  PAGE_SHELL_CLASS,
  PAGE_TITLE_CLASS,
  SECTION_HEADING_CLASS,
  TAB_ITEM_CLASS,
  TAB_ROW_CLASS,
} from "@/lib/ui/type-scale";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const SECTIONS = [
  { id: "business", label: "Business information", short: "Business" },
  { id: "offerings", label: "Products & services", short: "Offerings" },
  { id: "pricing", label: "Prices or rates", short: "Prices" },
  { id: "hours", label: "Hours & availability", short: "Hours" },
  { id: "policies", label: "Policies", short: "Policies" },
  { id: "faqs", label: "FAQs", short: "FAQs" },
  { id: "documents", label: "Custom knowledge", short: "Knowledge" },
  { id: "contact", label: "Contact details", short: "Contact" },
  { id: "escalation", label: "Human escalation", short: "Escalation" },
  { id: "operations", label: "Type-specific fields", short: "Type" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function KnowledgeEditor({
  knowledge: knowledgeProp,
  updateKnowledge: updateKnowledgeProp,
  setBusinessType: setBusinessTypeProp,
}: {
  knowledge?: KnowledgeBase | null;
  updateKnowledge?: (next: KnowledgeBase) => void;
  setBusinessType?: (type: BusinessType) => void;
} = {}) {
  const demo = useWorkspace();
  const knowledge = knowledgeProp !== undefined ? knowledgeProp : demo.knowledge;
  const updateKnowledge = updateKnowledgeProp ?? demo.updateKnowledge;
  const setBusinessType = setBusinessTypeProp ?? demo.setBusinessType;

  if (knowledgeProp === undefined) {
    return (
      <SetupGate
        title="Build one knowledge base"
        description="This is the only source of truth for website chat and email drafts. Add the facts a human would be allowed to say out loud."
      >
        {demo.knowledge ? (
          <EditorBody
            knowledge={demo.knowledge}
            updateKnowledge={demo.updateKnowledge}
            setBusinessType={demo.setBusinessType}
          />
        ) : null}
      </SetupGate>
    );
  }

  if (!knowledge) {
    return <p className="text-sm text-muted-foreground">Loading knowledge…</p>;
  }

  return (
    <EditorBody
      knowledge={knowledge}
      updateKnowledge={updateKnowledge}
      setBusinessType={setBusinessType}
    />
  );
}

function EditorBody({
  knowledge,
  updateKnowledge,
  setBusinessType,
}: {
  knowledge: KnowledgeBase;
  updateKnowledge: (next: KnowledgeBase) => void;
  setBusinessType: (type: BusinessType) => void;
}) {
  const [section, setSection] = useState<SectionId>("business");
  const kb = knowledge;

  const sectionLabel = useMemo(() => {
    if (!kb) return "";
    if (section === "offerings") return offeringLabel(kb.businessType);
    if (section === "operations") {
      if (showsStoreOperations(kb.businessType)) return "Store operations";
      if (showsServiceOperations(kb.businessType)) return "Service operations";
      if (showsClinicOperations(kb.businessType)) return "Clinic operations";
      return "Type-specific fields";
    }
    return SECTIONS.find((s) => s.id === section)?.label ?? section;
  }, [kb, section]);

  if (!kb) return null;

  const patch = (partial: Partial<KnowledgeBase>) => updateKnowledge({ ...kb, ...partial });

  return (
    <div className={PAGE_SHELL_CLASS}>
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
            Shared knowledge base
          </p>
          <h1 className={`${PAGE_TITLE_CLASS} mt-2`}>Teach BizPilot your business</h1>
          <p className={`mt-2 max-w-2xl ${HELPER_TEXT_CLASS}`}>
            Changes here apply immediately to website chat and to new or regenerated email drafts.
            Store-only fields stay hidden unless this is an online store.
          </p>
        </div>
        <Field label="Business type" className="lg:w-64">
          <Select
            value={kb.businessType}
            onValueChange={(value) => {
              setBusinessType(value as BusinessType);
              toast.message(`Showing fields for ${BUSINESS_TYPE_LABEL[value as BusinessType]}`);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["service", "clinic", "online_store", "custom"] as BusinessType[]).map((type) => (
                <SelectItem key={type} value={type}>
                  {BUSINESS_TYPE_LABEL[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <p className={`rounded-xl border bg-card px-3 py-3 ${HELPER_TEXT_CLASS}`}>
        {BUSINESS_TYPE_HINT[kb.businessType]}
      </p>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
        <aside className={`${TAB_ROW_CLASS} lg:sticky lg:top-6 lg:block lg:h-fit lg:overflow-visible lg:pb-0`}>
          {SECTIONS.map((item) => {
            const fullLabel =
              item.id === "offerings"
                ? offeringLabel(kb.businessType)
                : item.id === "operations"
                  ? showsStoreOperations(kb.businessType)
                    ? "Store operations"
                    : showsServiceOperations(kb.businessType)
                      ? "Service operations"
                      : showsClinicOperations(kb.businessType)
                        ? "Clinic operations"
                        : "Type-specific"
                  : item.label;
            const shortLabel =
              item.id === "offerings"
                ? "Offerings"
                : item.id === "operations"
                  ? "Type"
                  : item.short;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`${TAB_ITEM_CLASS} lg:w-full lg:justify-start ${
                  section === item.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground ring-1 ring-foreground/10 hover:text-foreground"
                }`}
              >
                <span className="md:hidden">{shortLabel}</span>
                <span className="hidden md:inline">{fullLabel}</span>
              </button>
            );
          })}
        </aside>

        <section className="min-w-0 rounded-2xl border bg-card p-3 shadow-sm md:p-6">
          <h2 className={SECTION_HEADING_CLASS}>{sectionLabel}</h2>
          <div className="mt-4 grid gap-4">
            {section === "business" && (
              <>
                <Field label="Business name">
                  <Input value={kb.name} onChange={(e) => patch({ name: e.target.value })} />
                </Field>
                <Field label="Tagline">
                  <Input value={kb.tagline} onChange={(e) => patch({ tagline: e.target.value })} />
                </Field>
                <Field label="Industry">
                  <Input value={kb.industry} onChange={(e) => patch({ industry: e.target.value })} />
                </Field>
                <Field
                  label="About the business"
                  hint="What you do, who you serve, and what you are not. This keeps chat from assuming you are a store — or a clinic."
                >
                  <Textarea
                    value={kb.description}
                    onChange={(e) => patch({ description: e.target.value })}
                    rows={5}
                  />
                </Field>
                <Field label="Voice for replies">
                  <Textarea
                    value={kb.voice}
                    onChange={(e) => patch({ voice: e.target.value })}
                    rows={3}
                  />
                </Field>
              </>
            )}

            {section === "offerings" && (
              <OfferingList kb={kb} patch={patch} />
            )}

            {section === "pricing" && (
              <Field
                label="Pricing notes"
                hint="Public rates, self-pay prices, or how billing works. Do not put unpublished discounts here if chat might auto-answer."
              >
                <Textarea
                  value={kb.pricingNotes}
                  onChange={(e) => patch({ pricingNotes: e.target.value })}
                  rows={6}
                />
              </Field>
            )}

            {section === "hours" && <HoursEditor kb={kb} patch={patch} />}

            {section === "policies" && (
              <PolicyList kb={kb} patch={patch} />
            )}

            {section === "faqs" && <FaqList kb={kb} patch={patch} />}

            {section === "documents" && <DocList kb={kb} patch={patch} />}

            {section === "contact" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Support email">
                  <Input
                    value={kb.contact.email}
                    onChange={(e) => patch({ contact: { ...kb.contact, email: e.target.value } })}
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    value={kb.contact.phone}
                    onChange={(e) => patch({ contact: { ...kb.contact, phone: e.target.value } })}
                  />
                </Field>
                <Field label="Address" className="sm:col-span-2">
                  <Input
                    value={kb.contact.address}
                    onChange={(e) => patch({ contact: { ...kb.contact, address: e.target.value } })}
                  />
                </Field>
                <Field label="Website">
                  <Input
                    value={kb.contact.website}
                    onChange={(e) => patch({ contact: { ...kb.contact, website: e.target.value } })}
                  />
                </Field>
                <Field label="Other contact notes">
                  <Input
                    value={kb.contact.extra}
                    onChange={(e) => patch({ contact: { ...kb.contact, extra: e.target.value } })}
                  />
                </Field>
              </div>
            )}

            {section === "escalation" && (
              <>
                <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/40 px-3 py-3">
                  <div>
                    <Label>Website chat may auto-answer safe questions</Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Email drafts are never sent automatically, even when this is on.
                    </p>
                  </div>
                  <Switch
                    checked={kb.escalation.autoAnswerChat}
                    onCheckedChange={(checked) =>
                      patch({
                        escalation: { ...kb.escalation, autoAnswerChat: Boolean(checked) },
                      })
                    }
                  />
                </div>
                <Field label="Always hand these topics to a human">
                  <Textarea
                    value={kb.escalation.alwaysEscalateTopics}
                    onChange={(e) =>
                      patch({
                        escalation: { ...kb.escalation, alwaysEscalateTopics: e.target.value },
                      })
                    }
                    rows={3}
                  />
                </Field>
                <Field label="Never auto-answer">
                  <Textarea
                    value={kb.escalation.neverAutoAnswer}
                    onChange={(e) =>
                      patch({
                        escalation: { ...kb.escalation, neverAutoAnswer: e.target.value },
                      })
                    }
                    rows={3}
                  />
                </Field>
                <Field label="Emergency instructions">
                  <Textarea
                    value={kb.escalation.emergencyInstructions}
                    onChange={(e) =>
                      patch({
                        escalation: { ...kb.escalation, emergencyInstructions: e.target.value },
                      })
                    }
                    rows={3}
                  />
                </Field>
                <Field label="Handoff message">
                  <Textarea
                    value={kb.escalation.handoffMessage}
                    onChange={(e) =>
                      patch({
                        escalation: { ...kb.escalation, handoffMessage: e.target.value },
                      })
                    }
                    rows={3}
                  />
                </Field>
                <Field label="After-hours note">
                  <Textarea
                    value={kb.escalation.afterHoursNote}
                    onChange={(e) =>
                      patch({
                        escalation: { ...kb.escalation, afterHoursNote: e.target.value },
                      })
                    }
                    rows={3}
                  />
                </Field>
              </>
            )}

            {section === "operations" && <OperationsEditor kb={kb} patch={patch} />}
          </div>
        </section>
      </div>
    </div>
  );
}

function OfferingList({
  kb,
  patch,
}: {
  kb: KnowledgeBase;
  patch: (partial: Partial<KnowledgeBase>) => void;
}) {
  const update = (id: string, next: Partial<Offering>) =>
    patch({
      offerings: kb.offerings.map((item) => (item.id === id ? { ...item, ...next } : item)),
    });

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        List products, services, or both. Kind is a label, not a storefront requirement.
      </p>
      {kb.offerings.map((offering, index) => (
        <div key={offering.id} className="grid gap-3 rounded-xl border p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {offeringLabel(kb.businessType, false)} {index + 1}
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                patch({ offerings: kb.offerings.filter((item) => item.id !== offering.id) })
              }
              aria-label="Remove offering"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input value={offering.name} onChange={(e) => update(offering.id, { name: e.target.value })} />
            </Field>
            <Field label="Kind">
              <Select
                value={offering.kind}
                onValueChange={(value) => update(offering.id, { kind: value as Offering["kind"] })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">{offeringKindLabel("service")}</SelectItem>
                  <SelectItem value="product">{offeringKindLabel("product")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Price or rate">
              <Input value={offering.price} onChange={(e) => update(offering.id, { price: e.target.value })} />
            </Field>
            <Field label="Availability">
              <Input
                value={offering.availability}
                onChange={(e) => update(offering.id, { availability: e.target.value })}
              />
            </Field>
            <Field label="Summary" className="sm:col-span-2">
              <Textarea
                value={offering.summary}
                onChange={(e) => update(offering.id, { summary: e.target.value })}
                rows={2}
              />
            </Field>
            <Field label="Details" className="sm:col-span-2">
              <Textarea
                value={offering.details}
                onChange={(e) => update(offering.id, { details: e.target.value })}
                rows={2}
              />
            </Field>
          </div>
        </div>
      ))}
      <Button
        variant="outline"
        onClick={() =>
          patch({
            offerings: [
              ...kb.offerings,
              {
                id: nid("off"),
                kind: defaultOfferingKind(kb.businessType),
                name: "",
                summary: "",
                price: "",
                availability: "",
                details: "",
              },
            ],
          })
        }
      >
        <Plus className="size-4" />
        Add {offeringLabel(kb.businessType, false).toLowerCase()}
      </Button>
    </div>
  );
}

export function HoursEditor({
  kb,
  patch,
}: {
  kb: KnowledgeBase;
  patch: (partial: Partial<KnowledgeBase>) => void;
}) {
  return (
    <div className="grid gap-4">
      <Field label="Timezone">
        <Input
          value={kb.hours.timezone}
          onChange={(e) => patch({ hours: { ...kb.hours, timezone: e.target.value } })}
        />
      </Field>
      <div className="grid gap-2">
        {kb.hours.days.map((day) => (
          <div key={day.day} className={HOURS_DAY_ROW_CLASS}>
            <div className="flex items-center justify-between gap-3 sm:contents">
              <span className="text-sm font-medium">{DAY_LABEL[day.day]}</span>
              <label className="flex items-center gap-2 text-xs text-muted-foreground sm:pt-1">
                <Switch
                  size="sm"
                  checked={!day.closed}
                  onCheckedChange={(checked) =>
                    patch({
                      hours: {
                        ...kb.hours,
                        days: kb.hours.days.map((item) =>
                          item.day === day.day ? { ...item, closed: !checked } : item,
                        ),
                      },
                    })
                  }
                />
                Open
              </label>
            </div>
            <div className={HOURS_TIME_FIELDS_CLASS}>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor={`hours-open-${day.day}`}>Opens</Label>
                <p
                  className="text-sm font-medium tabular-nums sm:hidden"
                  data-testid={`hours-open-display-${day.day}`}
                >
                  {day.closed ? "Closed" : formatClockTime(day.open)}
                </p>
                <Input
                  id={`hours-open-${day.day}`}
                  type="time"
                  disabled={day.closed}
                  value={day.open}
                  aria-label="Opens"
                  className={HOURS_TIME_INPUT_CLASS}
                  onChange={(e) =>
                    patch({
                      hours: {
                        ...kb.hours,
                        days: kb.hours.days.map((item) =>
                          item.day === day.day ? { ...item, open: e.target.value } : item,
                        ),
                      },
                    })
                  }
                />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor={`hours-close-${day.day}`}>Closes</Label>
                <p
                  className="text-sm font-medium tabular-nums sm:hidden"
                  data-testid={`hours-close-display-${day.day}`}
                >
                  {day.closed ? "Closed" : formatClockTime(day.close)}
                </p>
                <Input
                  id={`hours-close-${day.day}`}
                  type="time"
                  disabled={day.closed}
                  value={day.close}
                  aria-label="Closes"
                  className={HOURS_TIME_INPUT_CLASS}
                  onChange={(e) =>
                    patch({
                      hours: {
                        ...kb.hours,
                        days: kb.hours.days.map((item) =>
                          item.day === day.day ? { ...item, close: e.target.value } : item,
                        ),
                      },
                    })
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <Field label="Notes about availability">
        <Textarea
          value={kb.hours.notes}
          onChange={(e) => patch({ hours: { ...kb.hours, notes: e.target.value } })}
          rows={3}
        />
      </Field>
    </div>
  );
}

function PolicyList({
  kb,
  patch,
}: {
  kb: KnowledgeBase;
  patch: (partial: Partial<KnowledgeBase>) => void;
}) {
  const update = (id: string, next: Partial<Policy>) =>
    patch({
      policies: kb.policies.map((item) => (item.id === id ? { ...item, ...next } : item)),
    });
  return (
    <div className="grid gap-4">
      {kb.policies.map((policy) => (
        <div key={policy.id} className="grid gap-3 rounded-xl border p-3">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => patch({ policies: kb.policies.filter((item) => item.id !== policy.id) })}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <Field label="Policy title">
            <Input value={policy.title} onChange={(e) => update(policy.id, { title: e.target.value })} />
          </Field>
          <Field label="Summary">
            <Textarea
              value={policy.summary}
              onChange={(e) => update(policy.id, { summary: e.target.value })}
              rows={3}
            />
          </Field>
        </div>
      ))}
      <Button
        variant="outline"
        onClick={() =>
          patch({
            policies: [...kb.policies, { id: nid("pol"), title: "", summary: "" }],
          })
        }
      >
        <Plus className="size-4" />
        Add policy
      </Button>
    </div>
  );
}

function FaqList({
  kb,
  patch,
}: {
  kb: KnowledgeBase;
  patch: (partial: Partial<KnowledgeBase>) => void;
}) {
  const update = (id: string, next: Partial<FaqItem>) =>
    patch({
      faqs: kb.faqs.map((item) => (item.id === id ? { ...item, ...next } : item)),
    });
  return (
    <div className="grid gap-4">
      {kb.faqs.map((faq) => (
        <div key={faq.id} className="grid gap-3 rounded-xl border p-3">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => patch({ faqs: kb.faqs.filter((item) => item.id !== faq.id) })}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <Field label="Question">
            <Input value={faq.question} onChange={(e) => update(faq.id, { question: e.target.value })} />
          </Field>
          <Field label="Answer">
            <Textarea
              value={faq.answer}
              onChange={(e) => update(faq.id, { answer: e.target.value })}
              rows={3}
            />
          </Field>
        </div>
      ))}
      <Button
        variant="outline"
        onClick={() =>
          patch({
            faqs: [...kb.faqs, { id: nid("faq"), question: "", answer: "" }],
          })
        }
      >
        <Plus className="size-4" />
        Add FAQ
      </Button>
    </div>
  );
}

function DocList({
  kb,
  patch,
}: {
  kb: KnowledgeBase;
  patch: (partial: Partial<KnowledgeBase>) => void;
}) {
  const update = (id: string, next: Partial<KnowledgeDocument>) =>
    patch({
      documents: kb.documents.map((item) => (item.id === id ? { ...item, ...next } : item)),
    });
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Public documents can be used in automatic chat answers. Internal notes may appear in email
        drafts with a review warning, never as an unattended chat reply.
      </p>
      {kb.documents.map((doc) => (
        <div key={doc.id} className="grid gap-3 rounded-xl border p-3">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                patch({ documents: kb.documents.filter((item) => item.id !== doc.id) })
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <Field label="Title">
            <Input value={doc.title} onChange={(e) => update(doc.id, { title: e.target.value })} />
          </Field>
          <Field label="Visibility">
            <Select
              value={doc.visibility}
              onValueChange={(value) =>
                update(doc.id, { visibility: value as KnowledgeDocument["visibility"] })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public — chat may use this</SelectItem>
                <SelectItem value="internal">Internal — email drafts only, with review</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Contents">
            <Textarea
              value={doc.body}
              onChange={(e) => update(doc.id, { body: e.target.value })}
              rows={4}
            />
          </Field>
        </div>
      ))}
      <Button
        variant="outline"
        onClick={() =>
          patch({
            documents: [
              ...kb.documents,
              { id: nid("doc"), title: "", body: "", visibility: "public" },
            ],
          })
        }
      >
        <Plus className="size-4" />
        Add document
      </Button>
    </div>
  );
}

function OperationsEditor({
  kb,
  patch,
}: {
  kb: KnowledgeBase;
  patch: (partial: Partial<KnowledgeBase>) => void;
}) {
  if (showsStoreOperations(kb.businessType) && kb.store) {
    return (
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          These fields exist because this knowledge base is an online store. They are not required
          for service businesses or clinics, and they are not Shopify fields.
        </p>
        <Field label="Shipping and delivery">
          <Textarea
            value={kb.store.shippingPolicy}
            onChange={(e) => patch({ store: { ...kb.store!, shippingPolicy: e.target.value } })}
            rows={4}
          />
        </Field>
        <Field label="How to talk about stock">
          <Textarea
            value={kb.store.stockMessaging}
            onChange={(e) => patch({ store: { ...kb.store!, stockMessaging: e.target.value } })}
            rows={3}
          />
        </Field>
        <Field label="Payment methods">
          <Textarea
            value={kb.store.paymentMethods}
            onChange={(e) => patch({ store: { ...kb.store!, paymentMethods: e.target.value } })}
            rows={3}
          />
        </Field>
        <div className="flex items-center justify-between gap-4 rounded-xl border px-3 py-3">
          <div>
            <Label>Cash on delivery is offered</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Optional. Leave off unless this store actually takes COD.
            </p>
          </div>
          <Switch
            checked={kb.store.cashOnDelivery}
            onCheckedChange={(checked) =>
              patch({ store: { ...kb.store!, cashOnDelivery: Boolean(checked) } })
            }
          />
        </div>
        <Field label="Order tracking notes">
          <Textarea
            value={kb.store.orderTrackingNotes}
            onChange={(e) => patch({ store: { ...kb.store!, orderTrackingNotes: e.target.value } })}
            rows={3}
          />
        </Field>
      </div>
    );
  }

  if (showsServiceOperations(kb.businessType) && kb.serviceOps) {
    return (
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          Coverage, booking, and call-out rules for a service business. No catalog, shipping, or
          stock fields.
        </p>
        <Field label="Service area">
          <Textarea
            value={kb.serviceOps.serviceArea}
            onChange={(e) =>
              patch({ serviceOps: { ...kb.serviceOps!, serviceArea: e.target.value } })
            }
            rows={3}
          />
        </Field>
        <Field label="Booking lead time">
          <Textarea
            value={kb.serviceOps.bookingLeadTime}
            onChange={(e) =>
              patch({ serviceOps: { ...kb.serviceOps!, bookingLeadTime: e.target.value } })
            }
            rows={3}
          />
        </Field>
        <Field label="On-site vs remote">
          <Textarea
            value={kb.serviceOps.onsiteVsRemote}
            onChange={(e) =>
              patch({ serviceOps: { ...kb.serviceOps!, onsiteVsRemote: e.target.value } })
            }
            rows={3}
          />
        </Field>
        <Field label="Emergency call-out">
          <Textarea
            value={kb.serviceOps.emergencyCallout}
            onChange={(e) =>
              patch({ serviceOps: { ...kb.serviceOps!, emergencyCallout: e.target.value } })
            }
            rows={3}
          />
        </Field>
      </div>
    );
  }

  if (showsClinicOperations(kb.businessType) && kb.clinicOps) {
    return (
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          Appointment-based care. Chat may share hours, insurance lists, and booking steps. It must
          not diagnose.
        </p>
        <Field label="How to book">
          <Textarea
            value={kb.clinicOps.appointmentBooking}
            onChange={(e) =>
              patch({ clinicOps: { ...kb.clinicOps!, appointmentBooking: e.target.value } })
            }
            rows={3}
          />
        </Field>
        <Field label="Insurance accepted">
          <Textarea
            value={kb.clinicOps.insuranceAccepted}
            onChange={(e) =>
              patch({ clinicOps: { ...kb.clinicOps!, insuranceAccepted: e.target.value } })
            }
            rows={3}
          />
        </Field>
        <Field label="New patient process">
          <Textarea
            value={kb.clinicOps.newPatientProcess}
            onChange={(e) =>
              patch({ clinicOps: { ...kb.clinicOps!, newPatientProcess: e.target.value } })
            }
            rows={3}
          />
        </Field>
        <Field label="Emergency protocol">
          <Textarea
            value={kb.clinicOps.emergencyProtocol}
            onChange={(e) =>
              patch({ clinicOps: { ...kb.clinicOps!, emergencyProtocol: e.target.value } })
            }
            rows={3}
          />
        </Field>
        <Field label="Clinical advice rule">
          <Textarea
            value={kb.clinicOps.clinicalAdvicePolicy}
            onChange={(e) =>
              patch({ clinicOps: { ...kb.clinicOps!, clinicalAdvicePolicy: e.target.value } })
            }
            rows={3}
          />
        </Field>
      </div>
    );
  }

  return (
    <p className="text-sm leading-relaxed text-muted-foreground">
      No extra operations fields for this type. Use products and services, hours, policies, FAQs,
      and documents instead. Switch the business type to online store, service, or clinic if you
      need those layouts.
    </p>
  );
}
