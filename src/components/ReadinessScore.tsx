import { Card } from "@/components/ui/card";
import type { ProductRiskScan } from "@/lib/api";

interface ReadinessItem {
  label: string;
  done: boolean;
  priority?: boolean;
}

function getReadinessItems(scan: ProductRiskScan, htsCode: string): ReadinessItem[] {
  const hasBattery = scan.risk_categories.some((c) =>
    c.category.toLowerCase().includes("battery"),
  );
  const hasChildren = scan.risk_categories.some((c) =>
    c.category.toLowerCase().includes("children"),
  );
  const hasFda = scan.risk_categories.some((c) =>
    c.category.toLowerCase().includes("fda"),
  );
  const hasMarketplace = scan.risk_categories.some((c) =>
    c.category.toLowerCase().includes("marketplace"),
  );
  const hasForcedLabor = scan.risk_categories.some((c) =>
    c.category.toLowerCase().includes("forced"),
  );

  const items: ReadinessItem[] = [
    { label: "HTS code confirmed", done: !!htsCode, priority: true },
    { label: "Broker reviewed entry", done: false, priority: true },
    { label: "Section 301 tariff checked", done: false, priority: true },
    { label: "AD/CVD exposure checked", done: false },
    { label: "Supplier documents collected", done: false },
    { label: "Product test reports obtained", done: false },
    { label: "Labeling requirements reviewed", done: false },
  ];

  if (hasChildren) {
    items.push({ label: "CPSIA / Children's Product Certificate obtained", done: false, priority: true });
  }
  if (hasBattery) {
    items.push({ label: "UN 38.3 battery test report obtained", done: false, priority: true });
  }
  if (hasFda) {
    items.push({ label: "FDA requirements confirmed", done: false, priority: true });
  }
  if (hasMarketplace) {
    items.push({ label: "Marketplace compliance requirements checked", done: false });
  }
  if (hasForcedLabor) {
    items.push({ label: "Forced labor / UFLPA review completed", done: false, priority: true });
  }

  return items;
}

function scoreColor(score: number) {
  if (score >= 70) return "text-green-700";
  if (score >= 45) return "text-amber-700";
  return "text-red-700";
}

function scoreBg(score: number) {
  if (score >= 70) return "bg-green-500";
  if (score >= 45) return "bg-amber-500";
  return "bg-red-500";
}

export function ReadinessScore({
  scan,
  htsCode,
}: {
  scan: ProductRiskScan;
  htsCode: string;
}) {
  const items = getReadinessItems(scan, htsCode);
  const done = items.filter((i) => i.done).length;
  // Derive the percentage from the same checklist that drives "X of Y complete"
  // so the headline number and the count can never contradict each other.
  const score = items.length ? Math.round((done / items.length) * 100) : 0;
  const highPriorityMissing = items.filter((i) => i.priority && !i.done);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Launch readiness
          </p>
          <p className={`mt-1 text-3xl font-bold ${scoreColor(score)}`}>
            {score}%
          </p>
          <p className="text-xs text-muted-foreground">
            {done} of {items.length} checks complete
          </p>
        </div>
        {/* Progress ring (simple bar) */}
        <div className="flex-1">
          <div className="h-2.5 w-full rounded-full bg-slate-100">
            <div
              className={`h-2.5 rounded-full transition-all ${scoreBg(score)}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </div>

      {highPriorityMissing.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <p className="text-xs font-medium text-foreground">
            Priority items missing:
          </p>
          {highPriorityMissing.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
              {item.label}
            </div>
          ))}
        </div>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
          Show full checklist ({items.length} items)
        </summary>
        <ul className="mt-3 space-y-1.5">
          {items.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-xs">
              <span
                className={`h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                  item.done
                    ? "border-green-500 bg-green-500 text-white"
                    : "border-slate-300"
                }`}
              >
                {item.done && "✓"}
              </span>
              <span className={item.done ? "text-muted-foreground line-through" : "text-foreground"}>
                {item.label}
              </span>
              {item.priority && !item.done && (
                <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700">
                  Priority
                </span>
              )}
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
