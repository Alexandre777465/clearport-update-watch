import type { ProductRiskScan } from "@/lib/api";
import { useLang, t } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

interface Props {
  scan: ProductRiskScan;
}

export function NextStepsSection({ scan }: Props) {
  const lang = useLang();
  const steps = scan.next_actions ?? [];

  if (steps.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">
        {t(lang, "next_steps_title")}
      </h3>
      <Card className="divide-y overflow-hidden p-0">
        {steps.map((step, idx) => (
          <div key={idx} className="flex items-start gap-3 px-4 py-2.5">
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              {typeof step === "string" ? (
                <p className="text-sm">{step}</p>
              ) : (
                <>
                  <p className="text-sm font-medium">{(step as { action?: string }).action ?? String(step)}</p>
                  {(step as { rationale?: string }).rationale && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {(step as { rationale?: string }).rationale}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </Card>
    </section>
  );
}
