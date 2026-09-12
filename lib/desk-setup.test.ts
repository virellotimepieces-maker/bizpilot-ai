import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { workspaceSetup } from "./desk-setup";
import { emptyKnowledge } from "./empty-knowledge";

describe("workspace setup checklist", () => {
  it("marks knowledge, contact, website, sync, and queue separately", () => {
    const blank = workspaceSetup({
      knowledge: emptyKnowledge("custom"),
      websiteVerified: false,
      websitePageCount: 0,
      waitingOnHuman: 2,
    });
    assert.equal(blank.readyForWidget, false);
    assert.deepEqual(
      blank.items.map((item) => [item.key, item.done]),
      [
        ["knowledge", false],
        ["contact", false],
        ["website", false],
        ["sync", false],
        ["queue", false],
      ],
    );

    const ready = workspaceSetup({
      knowledge: {
        ...emptyKnowledge("custom"),
        name: "Harbor Clinic",
        description: "Family practice on the waterfront.",
        contact: { ...emptyKnowledge("custom").contact, email: "hello@harbor.example" },
      },
      websiteVerified: true,
      websitePageCount: 4,
      waitingOnHuman: 0,
    });
    assert.equal(ready.readyForWidget, true);
    assert.equal(ready.items.every((item) => item.done), true);
  });
});
