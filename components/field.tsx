import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { HELPER_TEXT_CLASS } from "@/lib/ui/type-scale";
import type { ReactNode } from "react";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-foreground/80">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="text-sm text-destructive md:text-base" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className={HELPER_TEXT_CLASS}>{hint}</p>
      ) : null}
    </div>
  );
}
