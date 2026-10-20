import Link from "next/link";
import { formatGuideDate, type GuideMeta } from "@/lib/guides";
import { SITE_NAME } from "@/lib/seo";

type Props = {
  meta: GuideMeta;
  /** Short label after the hub link, e.g. "Sniping" */
  sectionLabel: string;
  hubHref?: string;
  hubLabel?: string;
  title?: string;
  children?: React.ReactNode;
};

export function ArticleHeader({
  meta,
  sectionLabel,
  hubHref = "/guides",
  hubLabel = "Guides",
  title,
  children,
}: Props) {
  const updated = formatGuideDate(meta.dateModified);

  return (
    <header>
      <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">
        <Link href={hubHref} className="hover:underline">
          {hubLabel}
        </Link>
        {` / ${sectionLabel}`}
      </p>
      <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-zinc-100">
        {title ?? meta.title}
      </h1>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
        <span>
          By{" "}
          <Link href="/about" className="text-zinc-400 hover:text-emerald-400 hover:underline">
            {SITE_NAME}
          </Link>
          <span className="text-zinc-600"> · Editorial</span>
        </span>
        <span className="text-zinc-700" aria-hidden>
          ·
        </span>
        <time dateTime={meta.dateModified}>Updated: {updated}</time>
      </div>
      {children ? <div className="mt-4 text-base text-zinc-400">{children}</div> : null}
    </header>
  );
}
