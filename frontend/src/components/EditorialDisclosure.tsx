import Link from "next/link";
import { SITE_NAME } from "@/lib/seo";

export function EditorialDisclosure() {
  return (
    <p className="mt-10 rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-3 text-xs leading-relaxed text-zinc-500">
      <strong className="font-medium text-zinc-400">Disclosure:</strong> This page is published by{" "}
      {SITE_NAME}, the team behind the hosted ShopGoodwill sniper at this site. We describe our
      product accurately — including miss modes and fees — and we are not affiliated with
      ShopGoodwill or Goodwill Industries. See{" "}
      <Link href="/about" className="text-emerald-400 hover:underline">
        About
      </Link>{" "}
      and{" "}
      <Link href="/pricing" className="text-emerald-400 hover:underline">
        Pricing
      </Link>
      .
    </p>
  );
}
