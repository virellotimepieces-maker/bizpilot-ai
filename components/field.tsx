import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
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
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
