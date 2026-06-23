import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DocumentChecklistItem } from "@/lib/api";
import { CheckCircle2, Circle, AlertCircle, ExternalLink, Factory, FileCheck } from "lucide-react";
import { useLang, t } from "@/lib/i18n";

// Three responsibility groups (Stage 4):
//   supplier        — ask your overseas supplier/factory
//   importer_broker — the U.S. importer of record / customs broker files it
//   conditional     — applicability needs confirmation before it is mandatory
function groupOf(d: DocumentChecklistItem): "supplier" | "importer_broker" | "conditional" {
  if (d.responsibility) return d.responsibility;
  // Backward-compatible fallback for any legacy item without a responsibility.
  return d.required ? "supplier" : "conditional";
}

function SourceLink({ item }: { item: DocumentChecklistItem }) {
  const lang = useLang();
  const src = item.source;
  if (!src) return null;
  return (
    <div className="mt-1.5 text-xs text-muted-foreground">
      <span className="font-medium text-foreground/80">
        {src.agency ? `${src.agency} · ` : ""}
        {src.cfr_citation ?? src.title}
      </span>
      {src.url && (
        <a
          href={src.url}
          target="_blank"
          rel="noreferrer"
          className="ml-1 inline-flex items-center gap-0.5 text-primary hover:underline"
        >
          {t(lang, "doc_view_source")} <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function DocRow({
  doc,
  uploaded,
  badge,
}: {
  doc: DocumentChecklistItem;
  uploaded: boolean;
  badge: { label: string; className: string };
}) {
  return (
    <Card className={`p-3 ${uploaded ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-2">
        {uploaded ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
        ) : (
          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{doc.document}</span>
            <Badge variant="outline" className={`text-xs ${badge.className}`}>
              {badge.label}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{doc.reason}</p>
          <SourceLink item={doc} />
        </div>
      </div>
    </Card>
  );
}

export function DocumentChecklist({
  items,
  uploadedDocTypes = [],
}: {
  items: DocumentChecklistItem[];
  uploadedDocTypes?: string[];
}) {
  const lang = useLang();

  const supplier = items.filter((d) => groupOf(d) === "supplier");
  const broker = items.filter((d) => groupOf(d) === "importer_broker");
  const conditional = items.filter((d) => groupOf(d) === "conditional");

  const isUploaded = (doc: DocumentChecklistItem) =>
    uploadedDocTypes.some((t) =>
      t.toLowerCase().includes(doc.document.toLowerCase().slice(0, 8)),
    );

  const requiredItems = [...supplier, ...broker];
  const missingRequired = requiredItems.filter((d) => !isUploaded(d));

  const requiredBadge = {
    label: t(lang, "doc_required"),
    className: "border-red-200 bg-red-50 text-red-700",
  };
  const confirmBadge = {
    label: t(lang, "doc_needs_confirmation"),
    className: "border-amber-200 bg-amber-50 text-amber-800",
  };

  return (
    <div className="space-y-5">
      {missingRequired.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {t(lang, "doc_missing_prefix")} {missingRequired.length}{" "}
          {t(lang, "doc_missing_suffix")}
        </div>
      )}

      {/* A. Supplier documents */}
      {supplier.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Factory className="h-3.5 w-3.5" /> {t(lang, "doc_group_supplier")}
          </p>
          <div className="space-y-2">
            {supplier.map((doc) => (
              <DocRow key={doc.document} doc={doc} uploaded={isUploaded(doc)} badge={requiredBadge} />
            ))}
          </div>
        </div>
      )}

      {/* B. Importer / broker tasks */}
      {broker.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <FileCheck className="h-3.5 w-3.5" /> {t(lang, "doc_group_broker")}
          </p>
          <div className="space-y-2">
            {broker.map((doc) => (
              <DocRow key={doc.document} doc={doc} uploaded={isUploaded(doc)} badge={requiredBadge} />
            ))}
          </div>
        </div>
      )}

      {/* C. Applicability needs confirmation */}
      {conditional.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" /> {t(lang, "doc_group_conditional")}
          </p>
          <p className="mb-2 text-xs text-muted-foreground">{t(lang, "doc_group_conditional_help")}</p>
          <div className="space-y-2">
            {conditional.map((doc) => (
              <DocRow key={doc.document} doc={doc} uploaded={isUploaded(doc)} badge={confirmBadge} />
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <Card className="p-4 text-sm text-muted-foreground">{t(lang, "doc_none")}</Card>
      )}
    </div>
  );
}
