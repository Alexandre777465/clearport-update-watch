import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ProductRiskScan } from "@/lib/api";
import { Copy, Check, FileText } from "lucide-react";
import { useLang, t } from "@/lib/i18n";

interface BrokerPackProps {
  productName: string;
  description: string;
  htsCode: string;
  originCountry: string;
  destination: string;
  scan: ProductRiskScan;
}

function buildBrokerPackText(props: BrokerPackProps): string {
  const { productName, description, htsCode, originCountry, destination, scan } = props;

  const riskFlags = scan.risk_categories
    .filter((c) => c.level === "High" || c.level === "Critical")
    .map((c) => `- ${c.category} (${c.level}): ${c.explanation}`)
    .join("\n");

  const brokerQs = scan.broker_questions
    .map((q, i) => `${i + 1}. ${q}`)
    .join("\n");

  return `IMPORT COMPLIANCE INQUIRY — ${productName.toUpperCase()}
${"─".repeat(60)}

PRODUCT DETAILS
Product name:      ${productName}
Description:       ${description || "See attached"}
HTS / HS code:     ${htsCode || "To be confirmed"}
Country of origin: ${originCountry}
Import destination:${destination}

RISK FLAGS IDENTIFIED
${riskFlags || "No high-risk flags identified — please confirm."}

QUESTIONS FOR YOUR REVIEW
${brokerQs}

ADDITIONAL CONTEXT
Overall risk assessment: ${scan.overall_risk}
${scan.overall_summary}

Please advise on:
- Confirmed duty rate including all applicable tariffs
- Any active exclusions or tariff relief programs
- Required documentation for customs entry
- Any pending regulatory changes that may affect this product

This inquiry was prepared using ClearPort (clearport.io) which monitors official U.S. trade sources.
Please verify and advise. This is not a substitute for your professional assessment.
${"─".repeat(60)}`;
}

export function BrokerPack(props: BrokerPackProps) {
  const lang = useLang();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const text = buildBrokerPackText(props);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">{t(lang, "bp_title")}</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? t(lang, "bp_hide") : t(lang, "bp_preview")}
          </Button>
          <Button size="sm" onClick={copy}>
            {copied ? (
              <><Check className="mr-1.5 h-3.5 w-3.5" /> {t(lang, "bp_copied")}</>
            ) : (
              <><Copy className="mr-1.5 h-3.5 w-3.5" /> {t(lang, "bp_copy")}</>
            )}
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {t(lang, "bp_desc")}
      </p>
      {expanded && (
        <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-slate-50 p-4 font-mono text-xs text-foreground">
          {text}
        </pre>
      )}
    </Card>
  );
}
