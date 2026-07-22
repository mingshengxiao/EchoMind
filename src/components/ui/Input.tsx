import { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Input({ className, label, error, id, ...props }: InputProps) {
  const inputId = id || props.name || label;
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-zinc-800" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={cn(
          "min-h-[44px] w-full rounded-2xl border border-zinc-200 bg-white px-4 text-zinc-950 shadow-sm transition-colors duration-200 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          error && "border-red-400 focus-visible:ring-red-500",
          className,
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
