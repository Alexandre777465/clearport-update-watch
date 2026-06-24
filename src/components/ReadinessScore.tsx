import { Card } from "@/components/ui/card";
import type { ProductRiskScan } from "@/lib/api";
import { useLang, t } from "@/lib/i18n";

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

// Readiness is driven entirely by the backend, which computes it ONLY from
// supported findings (verified applicable + official-unconfirmed). The items
// shown are those same supported findings — never unsourced guidance.
export function ReadinessScore({ scan }: { scan: ProductRiskScan; htsCode?: string }) {
  const lang = useLang();
  const verified = scan.risk_categories.filter((c) => c.verification_status === "verified_applicable");
  const unconfirmed = scan.risk_categories.filter((c) => c.verification_status === "official_unconfirmed");
  const score = scan.readiness_score;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t(lang, "rep_readiness")}
          </p>
          <p className={`mt-1 text-3xl font-bold ${scoreColor(score)}`}>{score}%</p>
          <p className="text-xs text-muted-foreground">
            {verified.length}{" "}
            {t(lang, verified.length === 1 ? "ready_verified_req_one" : "ready_verified_req")} ·{" "}
            {unconfirmed.length} {t(lang, "ready_need_confirm")}
          </p>
        </div>
        <div className="flex-1">
          <div className="h-2.5 w-full rounded-full bg-slate-100">
            <div
              className={`h-2.5 rounded-full transition-all ${scoreBg(score)}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </div>

      {(verified.length > 0 || unconfirmed.length > 0) ? (
        <ul className="mt-4 space-y-1.5">
          {verified.map((c) => (
            <li key={c.category} className="flex items-center gap-2 text-xs">
              <span className="h-4 w-4 shrink-0 rounded-full border-2 border-green-500 bg-green-500 text-center text-[10px] leading-[14px] text-white">
                ✓
              </span>
              <span className="text-foreground">{c.category}</span>
              <span className="rounded bg-green-100 px-1 py-0.5 text-[10px] font-medium text-green-700">
                {t(lang, "vs_verified")}
              </span>
            </li>
          ))}
          {unconfirmed.map((c) => (
            <li key={c.category} className="flex items-center gap-2 text-xs">
              <span className="h-4 w-4 shrink-0 rounded-full border-2 border-amber-400" />
              <span className="text-foreground">{c.category}</span>
              <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700">
                {t(lang, "doc_needs_confirmation")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          {t(lang, "ready_none")}
        </p>
      )}
    </Card>
  );
}
