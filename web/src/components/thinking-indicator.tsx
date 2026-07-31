"use client";

import { cn } from "../lib/utils";

export function ThinkingIndicator({
  className,
  label = "Thinking",
  level = "label",
}: {
  className?: string;
  label?: string;
  level?: "heading" | "label";
}) {
  return (
    <span
      className={cn("thinking-indicator thinking-shimmer", className)}
      data-level={level}
    >
      {label}
    </span>
  );
}
