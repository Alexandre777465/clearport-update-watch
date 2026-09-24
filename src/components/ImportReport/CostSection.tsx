import type { ProductRiskScan } from "@/lib/api";
import { buildEnhancedCostRows } from "@/lib/scanDisplay";
import { useLang, t } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  scan: ProductRiskScan;
  customsValueUsd?: number;
  transportMode?: "ocean" | "air" | "truck" | "rail";
}

const STATUS_CLASS: Record<string, string> = {
  verified_applicable: "border-green-200 bg-green-50 text-green-700",
  not_applicable: "border-slate-200 bg-slate-50 text-slate-500",
  likely_match: "border-amber-200 bg-amber-50 text-amber-800",
  official_unconfirmed: "border-amber-200 bg-amber-50 text-amber-800",
  insufficient_info: "border-orange-200 bg-orange-50 text-orange-700",
  source_unavailable: "border-red-200 bg-red-50 text-red-700",
  informational_no_specific_rule: "border-blue-200 bg-blue-50 text-blue-700",
  no_applicable_rule: "border-slate-200 bg-slate-50 text-slate-500",
};

export function CostSection({ scan, customsValueUsd, transportMode }: Props) {
  const lang = useLang();
  const rows = buildEnhancedCostRows(scan, lang, customsValueUsd, transportMode);

  if (rows.length === 0) return null;

  const known = rows.filter((r) => r.ratePct !== null);
  const totalPct = known.reduce((sum, r) => sum + (r.ratePct ?? 0), 0);
  const hasUnknown = rows.some((r) => r.ratePct === null && r.status !== "not_applicable" && r.status !== "no_applicable_rule");

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">
        {t(lang, "check_section_costs")}
      </h3>
      <Card className="divide-y overflow-hidden p-0">
        {rows.map((row, idx) => (
          <div key={idx} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="text-foreground">{row.label}</span>
            <div className="flex items-center gap-2 text-right">
              {row.dollarText && (
                <span className="text-xs text-muted-foreground">{row.dollarText}</span>
              )}
              <Badge
                variant="outline"
                className={`text-xs ${STATUS_CLASS[row.status] ?? "border-slate-200 bg-slate-50 text-slate-500"}`}
              >
                {row.rateText ?? row.answer}
              </Badge>
            </div>
          </div>
        ))}
        {(known.length > 0 || hasUnknown) && (
          <div className="flex items-center justify-between px-4 py-2.5 text-sm font-medium">
            <span>{t(lang, "check_total_duty_rate")}</span>
            <span>
              {totalPct.toFixed(2)}%{hasUnknown ? "+" : ""}
            </span>
          </div>
        )}
      </Card>
    </section>
  );
}
