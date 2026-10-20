type TocItem = { id: string; label: string };

export function GuideToc({ items }: { items: TocItem[] }) {
  if (items.length < 3) return null;
  return (
    <nav
      aria-label="On this page"
      className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-5"
    >
      <p className="text-sm font-bold text-zinc-100">On this page</p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-zinc-400">
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} className="text-emerald-400/90 hover:underline">
              {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
