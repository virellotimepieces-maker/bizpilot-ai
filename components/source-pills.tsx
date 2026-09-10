import { Badge } from "@/components/ui/badge";
import { sourceLabel } from "@/lib/intent-labels";
import type { ReplySource } from "@/lib/types";

export function SourcePills({ sources }: { sources: ReplySource[] }) {
  if (!sources.length) {
    return (
      <p className="text-xs text-muted-foreground">
        No published knowledge matched this message.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {sources.map((source) => (
        <Badge
          key={`${source.kind}-${source.title}`}
          variant={source.visibility === "internal" ? "destructive" : "secondary"}
        >
          {sourceLabel(source)}
        </Badge>
      ))}
    </div>
  );
}
