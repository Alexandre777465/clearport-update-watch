/**
 * Full-page import analysis report.
 * Composes the domain scan output into sections using pure display helpers.
 * Never calls any engine functions — receives a completed ProductRiskScan.
 */

import type { ProductRiskScan } from "@/lib/api";
import { computeOverallStatus } from "@/lib/scanDisplay";
import { useLang, t } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldCheck, AlertTriangle, XCircle, Info } from "lucide-react";
import { CostSection } from "./CostSection";
import { RegulationsSection } from "./RegulationsSection";
import { ChecklistSection } from "./ChecklistSection";
import { MissingSection } from "./MissingSection";
import { NextStepsSection } from "./NextStepsSection";

interface Props {
  scan: ProductRiskScan;
  productName: string;
  originCountry: string;
  destinationCountry: string;
  customsValueUsd?: number;
  transportMode?: "ocean" | "air" | "truck" | "rail";
  onStartOver: () => void;
}

const STATUS_CONFIG = {
  ready: {
    icon: ShieldCheck,
    colorClass: "text-green-600",
    badgeClass: "border-green-200 bg-green-50 text-green-700",
  },
  checks: {
    icon: AlertTriangle,
    colorClass: "text-amber-600",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
  },
  donot: {
    icon: XCircle,
    colorClass: "text-red-600",
    badgeClass: "border-red-200 bg-red-50 text-red-700",
  },
  incomplete: {
    icon: Info,
    colorClass: "text-blue-600",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
  },
};

export function ReportShell({
  scan,
  productName,
  originCountry,
  destinationCountry,
  customsValueUsd,
  transportMode,
  onStartOver,
}: Props) {
  const lang = useLang();
  const status = computeOverallStatus(scan);
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="mt-0.5 h-8 w-8 shrink-0"
          onClick={onStartOver}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Icon className={`h-5 w-5 shrink-0 ${cfg.colorClass}`} />
            <h1 className="text-base font-semibold leading-tight">{productName}</h1>
            <Badge variant="outline" className={`text-xs ${cfg.badgeClass}`}>
              {t(lang, `imp_status_${status}` as Parameters<typeof t>[1])}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {originCountry} → {destinationCountry}
            {customsValueUsd != null
              ? ` · $${customsValueUsd.toLocaleString()} customs value`
              : ""}
          </p>
          {scan.overall_summary && (
            <p className="mt-2 text-sm text-foreground">{scan.overall_summary}</p>
          )}
        </div>
      </div>

      {/* Sections */}
      <CostSection
        scan={scan}
        customsValueUsd={customsValueUsd}
        transportMode={transportMode}
      />
      <RegulationsSection scan={scan} />
      <ChecklistSection scan={scan} />
      <MissingSection scan={scan} />
      <NextStepsSection scan={scan} />

      {/* Start over */}
      <div className="flex justify-center pt-2">
        <Button variant="outline" size="sm" onClick={onStartOver}>
          {lang === "zh" ? "检查另一个产品" : "Check another product"}
        </Button>
      </div>
    </div>
  );
}
