import { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-3xl border border-zinc-200 bg-white/85 p-6 shadow-soft backdrop-blur", className)} {...props} />;
}
