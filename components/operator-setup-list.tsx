import type { OperatorCheck } from "@/lib/operator-setup";

function statusLabel(item: OperatorCheck) {
  if (item.done) return item.required ? "Ready" : "Optional — ready";
  return item.required ? "Needs you" : "Optional — not set";
}

export function OperatorSetupList({ items }: { items: OperatorCheck[] }) {
  return (
    <ol className="grid gap-3">
      {items.map((item, index) => (
        <li key={item.key} className="text-sm">
          <p>
            <span className="font-medium">
              {index + 1}. {item.label}
            </span>{" "}
            <span className={item.done ? "text-muted-foreground" : "text-destructive"}>
              {statusLabel(item)}
            </span>
          </p>
          <p className="text-muted-foreground">{item.hint}</p>
          {item.missing.length ? (
            <p className="mt-1 font-mono text-xs">{item.missing.join(", ")}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
