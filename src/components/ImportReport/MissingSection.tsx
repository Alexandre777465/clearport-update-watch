import type { ProductRiskScan } from "@/lib/api";
import { collectMissingFacts } from "@/lib/scanDisplay";
import { useLang, t } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface Props {
  scan: ProductRiskScan;
}

export function MissingSection({ scan }: Props) {
  const lang = useLang();
  const missing = collectMissingFacts(scan);

  if (missing.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">
        {t(lang, "info_missing_title")}
      </h3>
      <Card className="divide-y overflow-hidden p-0">
        {missing.map((fact, idx) => (
          <div key={idx} className="flex items-start gap-3 px-4 py-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-sm text-foreground">{fact}</p>
          </div>
        ))}
      </Card>
    </section>
  );
}
