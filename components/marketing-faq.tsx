"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ_ITEMS } from "@/lib/marketing/copy";
import Link from "next/link";

export function MarketingFaq() {
  return (
    <Accordion className="rounded-lg border bg-card px-4" hiddenUntilFound>
      {FAQ_ITEMS.map((item) => (
        <AccordionItem key={item.id} value={item.id}>
          <AccordionTrigger className="py-4 text-base font-medium">
            {item.question}
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground">
            <p>{item.answer}</p>
            {"guide" in item ? (
              <p className="mt-2">
                <Link className="font-medium text-foreground underline-offset-2 hover:underline" href={item.guide.href}>
                  {item.guide.label}
                </Link>
              </p>
            ) : null}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
