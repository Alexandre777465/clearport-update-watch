/**
 * Document Vault — shows the required documents that are still missing, plus a
 * clearly-disabled "Coming soon" upload area. File upload is intentionally not
 * wired yet (it needs Supabase Storage), so the UI does not offer an active
 * control that cannot work.
 */

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DocumentChecklistItem } from "@/lib/api";
import { Lock } from "lucide-react";

export function DocumentVault({
  missingDocs = [],
}: {
  missingDocs?: DocumentChecklistItem[];
}) {
  const missingHighPriority = missingDocs.filter((d) => d.required);

  return (
    <div className="space-y-4">
      {missingHighPriority.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-foreground">
            Missing required documents:
          </p>
          {missingHighPriority.map((doc) => (
            <div
              key={doc.document}
              className="flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-800"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
              {doc.document} — {doc.reason}
            </div>
          ))}
        </div>
      )}

      <Card className="border-dashed p-5 opacity-75">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            Secure document upload
          </span>
          <Badge variant="outline" className="text-xs">
            Coming soon
          </Badge>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Soon you'll be able to store your test reports, certificates, and
          invoices here so everything is ready for your broker.
        </p>
      </Card>
    </div>
  );
}
