import Link from "next/link";
import { relatedGuides } from "@/lib/guides";

export function RelatedGuides({ currentHref }: { currentHref: string }) {
  const guides = relatedGuides(currentHref);
  if (!guides.length) return null;

  return (
    <aside className="mt-14 border-t border-zinc-800/80 pt-10">
      <h2 className="text-lg font-bold text-zinc-100">Related guides</h2>
      <ul className="mt-4 space-y-3">
        {guides.map((guide) => (
          <li key={guide.href}>
            <Link href={guide.href} className="group block">
              <span className="font-medium text-emerald-400 group-hover:underline">
                {guide.title}
              </span>
              <p className="mt-1 text-sm text-zinc-500">{guide.description}</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-zinc-500">
        <Link href="/guides" className="text-emerald-400 hover:underline">
          All guides
        </Link>
        {" · "}
        <Link href="/pricing" className="text-emerald-400 hover:underline">
          Pricing
        </Link>
      </p>
    </aside>
  );
}
