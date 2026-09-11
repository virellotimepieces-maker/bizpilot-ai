"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export function PasswordInput({
  id,
  value,
  onChange,
  required,
  minLength,
  autoComplete,
  invalid,
  describedBy,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="pr-9"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="absolute top-1/2 right-0.5 size-7 -translate-y-1/2 text-muted-foreground hover:bg-transparent hover:text-foreground"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </Button>
    </div>
  );
}
