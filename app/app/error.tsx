"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PAGE_SHELL_CLASS } from "@/lib/ui/type-scale";
import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={PAGE_SHELL_CLASS}>
      <EmptyState
        icon={TriangleAlert}
        title="This page could not load"
        description="The workspace is still here. Try again. If this keeps happening, open Overview and continue from there."
        action={
          <Button type="button" size="sm" onClick={() => reset()}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
