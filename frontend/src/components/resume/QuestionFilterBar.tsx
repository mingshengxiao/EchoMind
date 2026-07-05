"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

interface Props {
  search: string;
  difficulty: string;
  onSearchChange: (value: string) => void;
  onDifficultyChange: (value: string) => void;
}

const difficultyOptions = [
  { value: "", label: "全部难度" },
  { value: "junior", label: "初级" },
  { value: "mid", label: "中级" },
  { value: "senior", label: "高级" },
];

export function QuestionFilterBar({
  search,
  difficulty,
  onSearchChange,
  onDifficultyChange,
}: Props) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const clearSearch = useCallback(() => {
    onSearchChange("");
    inputRef.current?.focus();
  }, [onSearchChange]);

  return (
    <div className="flex items-center gap-3">
      {/* Search input */}
      <div
        className={`relative flex flex-1 items-center rounded-2xl border bg-white transition-colors duration-200 ${
          focused ? "border-zinc-400" : "border-zinc-200"
        }`}
      >
        <Search aria-hidden="true" className="ml-3 h-4 w-4 text-zinc-400" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="搜索题目..."
          className="w-full bg-transparent px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none"
        />
        {search && (
          <button
            type="button"
            onClick={clearSearch}
            className="mr-2 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Difficulty filter */}
      <div className="relative flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2.5">
        <SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-zinc-400" />
        <select
          value={difficulty}
          onChange={(e) => onDifficultyChange(e.target.value)}
          className="appearance-none bg-transparent pr-4 text-sm text-zinc-700 focus:outline-none"
        >
          {difficultyOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
