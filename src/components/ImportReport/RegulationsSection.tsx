import type { ProductRiskScan } from "@/lib/api";
import { RiskScanCard } from "@/components/RiskScanCard";
import { useLang, t } from "@/lib/i18n";

interface Props {
  scan: ProductRiskScan;
}

export function RegulationsSection({ scan }: Props) {
  const lang = useLang();
  const tariffCatIds = new Set(
    (scan.coverage_matrix ?? []).map((c) => c.finding_id).filter(Boolean),
  );

  const regulatoryCategories = scan.risk_categories.filter((c) => {
    if (c.level === "N/A" && c.verification_status !== "not_applicable") return false;
    if (
      c.id &&
      (tariffCatIds.has(c.id) ||
        c.id.startsWith("adcvd_") ||
        c.id.startsWith("ieepa_"))
    )
      return false;
    if (c.id?.startsWith("hts_")) return false;
    return true;
  });

  if (regulatoryCategories.length === 0) return null;

  const regulatoryScan: ProductRiskScan = {
    ...scan,
    risk_categories: regulatoryCategories,
  };

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">
        {t(lang, "check_section_regulations")}
      </h3>
      <RiskScanCard scan={regulatoryScan} />
    </section>
  );
}
