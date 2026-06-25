import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProductRiskScan, VerificationStatus } from "@/lib/api";
import { CheckCircle2, ExternalLink, Info } from "lucide-react";
import { useLang, t, type Lang } from "@/lib/i18n";

function statusBadge(status: VerificationStatus | undefined, lang: Lang): { label: string; className: string } {
  switch (status) {
    case "verified_applicable":
      return { label: t(lang, "vs_verified"), className: "border-green-200 bg-green-50 text-green-700" };
    case "official_unconfirmed":
      return { label: t(lang, "vs_unconfirmed"), className: "border-amber-200 bg-amber-50 text-amber-800" };
    default:
      return { label: t(lang, "vs_none"), className: "border-slate-200 bg-slate-50 text-slate-500" };
  }
}

function findingIcon(status: VerificationStatus | undefined) {
  switch (status) {
    case "verified_applicable": return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "official_unconfirmed": return <Info className="h-4 w-4 text-amber-600" />;
    default: return <Info className="h-4 w-4 text-slate-400" />;
  }
}

export function RiskScanCard({ scan }: { scan: ProductRiskScan }) {
  const lang = useLang();
  const relevant = scan.risk_categories.filter((c) => c.level !== "N/A");

  return (
    <div className="space-y-2">
      {relevant.map((cat, idx) => (
        <Card key={cat.id ?? cat.category ?? idx} className="p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">{findingIcon(cat.verification_status)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{cat.category}</span>
                {(() => {
                  const sb = statusBadge(cat.verification_status, lang);
                  return (
                    <Badge variant="outline" className={`text-xs ${sb.className}`}>
                      {sb.label}
                    </Badge>
                  );
                })()}
              </div>

              {cat.verification_status === "no_verified_source" ? (
                <>
                  <p className="mt-2 text-xs text-muted-foreground">{cat.explanation}</p>
                  {cat.missing_info && (
                    <p className="mt-1.5 text-xs">
                      <span className="font-semibold text-foreground">
                        {t(lang, "rs_needs_verify")}{" "}
                      </span>
                      <span className="text-muted-foreground">{cat.missing_info}</span>
                    </p>
                  )}
                </>
              ) : (
                <>
                  {cat.what_changed && (
                    <p className="mt-2 text-xs">
                      <span className="font-semibold text-foreground">{t(lang, "rs_what_changed")} </span>
                      <span className="text-muted-foreground">{cat.what_changed}</span>
                    </p>
                  )}

                  <p className="mt-1.5 text-xs">
                    <span className="font-semibold text-foreground">{t(lang, "rs_how_affects")} </span>
                    <span className="text-muted-foreground">{cat.explanation}</span>
                  </p>

                  {cat.applicability_conditions && (
                    <p className="mt-1.5 text-xs">
                      <span className="font-semibold text-foreground">{t(lang, "rs_applies_when")} </span>
                      <span className="text-muted-foreground">{cat.applicability_conditions}</span>
                    </p>
                  )}

                  {cat.financial_impact && (
                    <p className="mt-1.5 text-xs">
                      <span className="font-semibold text-foreground">{t(lang, "rs_fin_impact")} </span>
                      <span className="text-muted-foreground">{cat.financial_impact}</span>
                    </p>
                  )}

                  {cat.action && (
                    <p className="mt-1.5 text-xs">
                      <span className="font-semibold text-foreground">{t(lang, "rs_required_action")} </span>
                      <span className="text-muted-foreground">{cat.action}</span>
                    </p>
                  )}
                </>
              )}

              {/* Official source */}
              {cat.source && (
                <div className="mt-2.5 rounded-md border border-slate-200 bg-slate-50/60 p-2.5 text-xs">
                  <p className="font-medium text-foreground">{t(lang, "rs_official_source")}</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {cat.source.agency ? `${cat.source.agency} · ` : ""}
                    {cat.source.name} — {cat.source.title}
                  </p>
                  {cat.source.cfr_citation && (
                    <p className="mt-0.5 text-muted-foreground">{t(lang, "rs_citation")} {cat.source.cfr_citation}</p>
                  )}
                  <p className="mt-0.5 text-muted-foreground">
                    {cat.source.published_at ? `${t(lang, "rs_published")} ${cat.source.published_at.slice(0, 10)}` : ""}
                    {cat.source.effective_date
                      ? ` · ${t(lang, "rs_effective_rev")} ${cat.source.effective_date.slice(0, 10)}`
                      : ""}
                    {cat.source.last_verified_at
                      ? ` · ${t(lang, "rs_last_verified")} ${cat.source.last_verified_at.slice(0, 10)}`
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
                      {t(lang, "rs_view_doc")} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
