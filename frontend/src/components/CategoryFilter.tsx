"use client";

import { useEffect, useMemo, useState } from "react";
import { Category } from "@/lib/api";

interface CategoryFilterProps {
  categories: Category[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  onClear: () => void;
  loading?: boolean;
  compact?: boolean;
}

/**
 * Toggle a category id with parent/child mutual exclusion within a branch:
 * selecting a parent clears its children; selecting a child clears its parent.
 * Sibling selections are unchanged.
 */
export function nextCategorySelection(
  categories: Category[],
  selectedIds: number[],
  toggledId: number,
): number[] {
  if (selectedIds.includes(toggledId)) {
    return selectedIds.filter(id => id !== toggledId);
  }

  const parent = categories.find(c => c.id === toggledId);
  if (parent?.children?.length) {
    const childIds = new Set(parent.children.map(c => c.id));
    return [...selectedIds.filter(id => !childIds.has(id)), toggledId];
  }

  for (const p of categories) {
    if ((p.children ?? []).some(c => c.id === toggledId)) {
      return [...selectedIds.filter(id => id !== p.id), toggledId];
    }
  }

  return [...selectedIds, toggledId];
}

function chipClass(selected: boolean, compact: boolean): string {
  return `font-medium transition-all border ${
    compact ? "text-[11px] px-2 py-0.5 rounded-md" : "text-xs px-3 py-1.5 rounded-xl"
  } ${
    selected
      ? "bg-green-900/40 border-green-700 text-green-300 light:bg-green-50 light:border-green-300 light:text-green-800"
      : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300"
  }`;
}

function CategoryBranch({
  cat,
  selectedSet,
  expanded,
  onToggle,
  onToggleExpand,
  compact,
}: {
  cat: Category;
  selectedSet: Set<number>;
  expanded: Set<number>;
  onToggle: (id: number) => void;
  onToggleExpand: (id: number) => void;
  compact: boolean;
}) {
  const kids = cat.children ?? [];
  const hasKids = kids.length > 0;
  const isOpen = expanded.has(cat.id);
  const selected = selectedSet.has(cat.id);
  const childSelectedCount = kids.filter(c => selectedSet.has(c.id)).length;

  return (
    <div>
      <div className="flex items-center gap-1 min-w-0">
        {hasKids ? (
          <button
            type="button"
            onClick={() => onToggleExpand(cat.id)}
            aria-label={isOpen ? `Collapse ${cat.name}` : `Expand ${cat.name}`}
            aria-expanded={isOpen}
            className="w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors flex-shrink-0"
          >
            <svg
              className={`w-3 h-3 transition-transform ${isOpen ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="w-5 flex-shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onToggle(cat.id)}
          className={`${chipClass(selected, compact)} min-w-0 truncate max-w-full`}
          title={cat.name}
        >
          {cat.name}
          {hasKids && childSelectedCount > 0 && !selected && (
            <span className="ml-1 text-[10px] opacity-70">{childSelectedCount}</span>
          )}
        </button>
      </div>

      {hasKids && isOpen && (
        <div className={`flex flex-wrap ml-5 mt-1 ${compact ? "gap-1" : "gap-1.5"}`}>
          {kids.map(child => (
            <button
              key={child.id}
              type="button"
              onClick={() => onToggle(child.id)}
              className={chipClass(selectedSet.has(child.id), compact)}
              title={child.name}
            >
              {child.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryFilter({
  categories,
  selectedIds,
  onToggle,
  onClear,
  loading = false,
  compact = false,
}: CategoryFilterProps) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const initiallyExpanded = useMemo(() => {
    const open = new Set<number>();
    for (const parent of categories) {
      const kids = parent.children ?? [];
      if (kids.some(c => selectedSet.has(c.id))) open.add(parent.id);
    }
    return open;
  }, [categories, selectedSet]);

  const [expanded, setExpanded] = useState<Set<number>>(initiallyExpanded);

  // Keep parents with selected children open when filters load / change
  useEffect(() => {
    setExpanded(prev => {
      const next = new Set(prev);
      for (const id of initiallyExpanded) next.add(id);
      return next;
    });
  }, [initiallyExpanded]);

  if (loading) {
    return <p className="text-xs text-zinc-600">Loading categories…</p>;
  }

  if (categories.length === 0) {
    return <p className="text-xs text-zinc-600">Could not load categories from SGW.</p>;
  }

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Explicit split — CSS column-count was flowing chips into more than 2 visual columns.
  const mid = Math.ceil(categories.length / 2);
  const columns = [categories.slice(0, mid), categories.slice(mid)];

  return (
    <div>
      <div className={`grid grid-cols-2 gap-x-4 gap-y-0 ${compact ? "" : "mb-3"}`}>
        {columns.map((col, colIdx) => (
          <div key={colIdx} className="flex flex-col gap-1.5 min-w-0">
            {col.map(cat => (
              <CategoryBranch
                key={cat.id}
                cat={cat}
                selectedSet={selectedSet}
                expanded={expanded}
                onToggle={onToggle}
                onToggleExpand={toggleExpand}
                compact={compact}
              />
            ))}
          </div>
        ))}
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
