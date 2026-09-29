import type { Faq } from "@/lib/seo";

export function FaqJsonLd({ faqs }: { faqs: Faq[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function FaqSection({
  faqs,
  title = "Frequently asked questions",
}: {
  faqs: Faq[];
  title?: string;
}) {
  return (
    <section className="border-t border-zinc-800/80 py-16">
      <FaqJsonLd faqs={faqs} />
      <h2 className="text-center text-2xl font-black tracking-tight text-zinc-100">{title}</h2>
      <div className="mx-auto mt-8 max-w-3xl divide-y divide-zinc-800 rounded-2xl border border-zinc-800 bg-zinc-900">
        {faqs.map((faq) => (
          <details key={faq.q} className="group px-5 py-4">
            <summary className="cursor-pointer list-none font-medium text-zinc-100 [&::-webkit-details-marker]:hidden">
              <span className="flex items-start justify-between gap-4">
                {faq.q}
                <span className="text-zinc-500 group-open:rotate-45 transition-transform">+</span>
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">{faq.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
