import type { ProductRiskScan } from "@/lib/api";
import { useLang, t } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle } from "lucide-react";

interface Props {
  scan: ProductRiskScan;
}

export function ChecklistSection({ scan }: Props) {
  const lang = useLang();
  const items = scan.document_checklist ?? [];

  if (items.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">
        {t(lang, "docs_section_title")}
      </h3>
      <Card className="divide-y overflow-hidden p-0">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-3 px-4 py-2.5">
            <div className="mt-0.5 shrink-0">
              {item.required ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{item.document}</p>
              {item.notes && (
                <p className="mt-0.5 text-xs text-muted-foreground">{item.notes}</p>
              )}
            </div>
            {item.required && (
              <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700 border border-red-200">
                {t(lang, "doc_required")}
              </span>
            )}
          </div>
        ))}
      </Card>
    </section>
  );
}
