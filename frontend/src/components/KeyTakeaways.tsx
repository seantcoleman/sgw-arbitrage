type Props = { items: string[] };

export function KeyTakeaways({ items }: Props) {
  if (!items.length) return null;
  return (
    <aside className="mt-8 rounded-2xl border border-emerald-900/40 bg-emerald-950/20 px-5 py-5">
      <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
        Key takeaways
      </h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </aside>
  );
}
