import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BizPilot widget sandbox",
  robots: { index: false, follow: false },
};

const SANDBOX_WIDGET_KEY = "sandbox";

export default function WidgetSandboxPage() {
  return (
    <div className="min-h-dvh bg-[#f6f1e8] text-neutral-900">
      <header className="border-b border-neutral-200 bg-white px-4 py-4 sm:px-8">
        <p className="text-xs tracking-[0.18em] text-neutral-500 uppercase">Harbor & Pine</p>
        <h1 className="font-heading mt-1 text-2xl">Weekend linen drop</h1>
      </header>
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-8">
        <p className="max-w-2xl text-sm leading-relaxed text-neutral-700">
          This sandbox loads the generated <code>/w/{SANDBOX_WIDGET_KEY}.js</code> embed the same way
          a customer website does. On load you should only see a round chat button. The storefront
          stays visible behind it.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { name: "Stonewash duvet", price: "$168" },
            { name: "Cedar table runner", price: "$54" },
            { name: "Olive throw pillow", price: "$42" },
            { name: "Daylight curtain set", price: "$96" },
          ].map((item) => (
            <article key={item.name} className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="mb-3 h-28 rounded-xl bg-neutral-200" />
              <h2 className="font-medium">{item.name}</h2>
              <p className="text-sm text-neutral-600">{item.price}</p>
            </article>
          ))}
        </div>
      </main>
      <script src={`/w/${SANDBOX_WIDGET_KEY}.js`} async />
    </div>
  );
}
