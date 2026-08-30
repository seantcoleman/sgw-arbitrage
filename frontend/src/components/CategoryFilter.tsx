"use client";

import { Category } from "@/lib/api";

interface CategoryFilterProps {
  categories: Category[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  onClear: () => void;
  loading?: boolean;
  compact?: boolean;
}

export function CategoryFilter({
  categories,
  selectedIds,
  onToggle,
  onClear,
  loading = false,
  compact = false,
}: CategoryFilterProps) {
  if (loading) {
    return <p className="text-xs text-zinc-600">Loading categories…</p>;
  }

  if (categories.length === 0) {
    return <p className="text-xs text-zinc-600">Could not load categories from SGW.</p>;
  }

  return (
    <div>
      <div className={`flex flex-wrap ${compact ? "gap-1" : "gap-2 mb-3"}`}>
        {categories.map(cat => {
          const selected = selectedIds.includes(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onToggle(cat.id)}
              className={`font-medium transition-all border ${
                compact
                  ? "text-[11px] px-2 py-0.5 rounded-md"
                  : "text-xs px-3 py-1.5 rounded-xl"
              } ${
                selected
                  ? "bg-green-900/40 border-green-700 text-green-300 light:bg-green-50 light:border-green-300 light:text-green-800"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300"
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>
      {!compact && selectedIds.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Clear all (scan everything)
        </button>
      )}
    </div>
  );
}
