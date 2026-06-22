import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProductRiskScan, RiskLevel } from "@/lib/api";
import { AlertTriangle, CheckCircle2, ExternalLink, Info, ShieldAlert, ShieldCheck } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

export function riskColor(level: RiskLevel) {
  switch (level) {
    case "Critical": return "border-red-200 bg-red-50 text-red-800";
    case "High":     return "border-orange-200 bg-orange-50 text-orange-800";
    case "Medium":   return "border-amber-200 bg-amber-50 text-amber-800";
    case "Low":      return "border-green-200 bg-green-50 text-green-800";
    default:         return "border-slate-200 bg-slate-50 text-slate-500";
  }
}

function riskIcon(level: RiskLevel) {
  switch (level) {
    case "Critical": return <ShieldAlert className="h-4 w-4 text-red-600" />;
    case "High":     return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    case "Medium":   return <Info className="h-4 w-4 text-amber-600" />;
    case "Low":      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    default:         return <Info className="h-4 w-4 text-slate-400" />;
  }
}

function overallBg(level: string) {
  switch (level) {
    case "Critical": return "bg-red-50 border-red-200";
    case "High":     return "bg-orange-50 border-orange-200";
    case "Medium":   return "bg-amber-50 border-amber-200";
    case "Low":      return "bg-green-50 border-green-200";
    default:         return "bg-slate-50 border-slate-200";
  }
}

function overallTextColor(level: string) {
  switch (level) {
    case "Critical": return "text-red-900";
    case "High":     return "text-orange-900";
    case "Medium":   return "text-amber-900";
    case "Low":      return "text-green-900";
    default:         return "text-slate-700";
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RiskScanCard({ scan }: { scan: ProductRiskScan }) {
  const relevant = scan.risk_categories.filter((c) => c.level !== "N/A");

  return (
    <div className="space-y-4">
      {/* Overall risk */}
      <Card className={`border p-5 ${overallBg(scan.overall_risk)}`}>
        <div className="flex items-center gap-3">
          {scan.overall_risk === "Critical" || scan.overall_risk === "High"
            ? <ShieldAlert className={`h-5 w-5 shrink-0 ${scan.overall_risk === "Critical" ? "text-red-600" : "text-orange-600"}`} />
            : <ShieldCheck className={`h-5 w-5 shrink-0 ${scan.overall_risk === "Low" ? "text-green-600" : "text-amber-600"}`} />
          }
          <div>
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${overallTextColor(scan.overall_risk)}`}>
                Overall risk: {scan.overall_risk}
              </span>
              <Badge variant="outline" className={riskColor(scan.overall_risk as RiskLevel)}>
                {scan.overall_risk}
              </Badge>
            </div>
            <p className={`mt-1 text-sm ${overallTextColor(scan.overall_risk)}`}>
              {scan.overall_summary}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3 w-3" />
          Confidence: {scan.confidence_level} · Generated from official regulatory requirements
        </div>
      </Card>

      {/* Risk categories */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Risk breakdown</h3>
        <div className="space-y-2">
          {relevant.map((cat) => (
            <Card key={cat.category} className="p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{riskIcon(cat.level as RiskLevel)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{cat.category}</span>
                    <Badge variant="outline" className={`text-xs ${riskColor(cat.level as RiskLevel)}`}>
                      {cat.level}
                    </Badge>
                    {cat.verified && cat.source ? (
                      <Badge variant="outline" className="text-xs border-green-200 bg-green-50 text-green-700">
                        ✓ Verified against official source
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs border-slate-200 bg-slate-50 text-slate-500">
                        General guidance — not verified against a current source
                      </Badge>
                    )}
                  </div>

                  {/* 1. What changed (verified only) */}
                  {cat.verified && cat.what_changed && (
                    <p className="mt-2 text-xs">
                      <span className="font-semibold text-foreground">What changed: </span>
                      <span className="text-muted-foreground">{cat.what_changed}</span>
                    </p>
                  )}

                  {/* 2. How it affects this product */}
                  <p className="mt-1.5 text-xs">
                    <span className="font-semibold text-foreground">How it affects this product: </span>
                    <span className="text-muted-foreground">{cat.explanation}</span>
                  </p>

                  {/* 3. Estimated financial impact (only when computed from a verified rate) */}
                  {cat.financial_impact && (
                    <p className="mt-1.5 text-xs">
                      <span className="font-semibold text-foreground">Estimated financial impact: </span>
                      <span className="text-muted-foreground">{cat.financial_impact}</span>
                    </p>
                  )}

                  {/* 4. Required action */}
                  <p className="mt-1.5 text-xs">
                    <span className="font-semibold text-foreground">Required action: </span>
                    <span className="text-muted-foreground">{cat.action}</span>
                  </p>

                  {/* 5. Official source (verified only) */}
                  {cat.verified && cat.source && (
                    <div className="mt-2.5 rounded-md border border-green-100 bg-green-50/50 p-2.5 text-xs">
                      <p className="font-medium text-foreground">Official source</p>
                      <p className="mt-0.5 text-muted-foreground">
                        {cat.source.name} — {cat.source.title}
                      </p>
                      <p className="mt-0.5 text-muted-foreground">
                        Published {cat.source.published_at?.slice(0, 10)}
                        {cat.source.effective_date
                          ? ` · Effective ${cat.source.effective_date.slice(0, 10)}`
                          : ""}
                      </p>
                      {cat.source.why_relevant && (
                        <p className="mt-0.5 text-muted-foreground">{cat.source.why_relevant}</p>
                      )}
                      {cat.source.url && (
                        <a
                          href={cat.source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          View official document <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Next actions */}
      {scan.next_actions.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">What to do next</h3>
          <Card className="p-4">
            <ol className="space-y-2">
              {scan.next_actions.map((action, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-foreground">{action}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      )}
    </div>
  );
}
