import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DocumentChecklistItem, DocItemStatus, ResponsibleParty } from "@/lib/api";
import {
  CheckCircle2, Circle, AlertCircle, ExternalLink,
  Factory, FileCheck, Truck, FlaskConical,
} from "lucide-react";
import { useLang, t, type DictKey } from "@/lib/i18n";

function groupOf(d: DocumentChecklistItem): "supplier" | "importer_broker" | "carrier" | "conditional" {
  if (d.responsibility === "carrier") return "carrier";
  if (d.responsibility === "supplier") return "supplier";
  if (d.responsibility === "importer_broker") return "importer_broker";
  if (d.responsibility === "conditional") return "conditional";
  return d.required ? "supplier" : "conditional";
}

function deriveDocStatus(d: DocumentChecklistItem): DocItemStatus {
  if (d.doc_status) return d.doc_status;
  if (d.responsibility === "conditional" || !d.required) return "cannot_determine";
  return "required_to_clear";
}

function docStatusBadge(status: DocItemStatus, condition?: string): { labelKey: DictKey; className: string; suffix?: string } {
  switch (status) {
    case "required_to_clear":
      return { labelKey: "doc_status_required_to_clear", className: "border-red-200 bg-red-50 text-red-700" };
    case "required_if":
      return { labelKey: "doc_status_required_if", className: "border-amber-200 bg-amber-50 text-amber-800", suffix: condition };
    case "usually_requested":
      return { labelKey: "doc_status_usually_requested", className: "border-blue-200 bg-blue-50 text-blue-700" };
    case "before_sale":
      return { labelKey: "doc_status_before_sale", className: "border-purple-200 bg-purple-50 text-purple-700" };
    case "not_required":
      return { labelKey: "doc_status_not_required", className: "border-slate-200 bg-slate-50 text-slate-400" };
    case "cannot_determine":
      return { labelKey: "doc_status_cannot_determine", className: "border-amber-200 bg-amber-50 text-amber-700" };
  }
}

function responsiblePartyLabel(party: ResponsibleParty | undefined, responsibility: string | undefined): DictKey | null {
  const rp = party ?? (responsibility === "supplier" ? "supplier" : responsibility === "importer_broker" ? "customs_broker" : null);
  switch (rp) {
    case "supplier": return "resp_supplier";
    case "importer": return "resp_importer";
    case "customs_broker": return "resp_customs_broker";
    case "carrier": return "resp_carrier";
    case "laboratory": return "resp_laboratory";
    default: return null;
  }
}

function DocRow({ doc, uploaded }: { doc: DocumentChecklistItem; uploaded: boolean }) {
  const lang = useLang();
  const src = doc.source;
  const hasSource = !!(src?.agency || src?.cfr_citation || src?.title || src?.url);
  const docStatus = deriveDocStatus(doc);
  const badge = docStatusBadge(docStatus, doc.condition);
  const partyKey = responsiblePartyLabel(doc.responsible_party, doc.responsibility);

  return (
    <div className={`flex items-start gap-2 py-2.5 ${uploaded ? "opacity-60" : ""}`}>
      {uploaded ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{doc.document}</span>
          <Badge variant="outline" className={`text-xs ${badge.className}`}>
            {t(lang, badge.labelKey)}{badge.suffix ? ` ${badge.suffix}` : ""}
          </Badge>
          {partyKey && (
            <span className="text-xs text-muted-foreground">{t(lang, partyKey)}</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{doc.reason}</p>
        {docStatus === "cannot_determine" && doc.missing_fact && (
          <p className="mt-0.5 text-xs text-amber-700">Missing: {doc.missing_fact}</p>
        )}
        {hasSource && (
          <details className="mt-1">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
              {t(lang, "doc_view_source")}
            </summary>
            <div className="mt-1 text-xs text-muted-foreground pl-2 border-l border-border">
              {(src?.agency || src?.cfr_citation || src?.title) && (
                <span className="font-medium text-foreground/80">
                  {src?.agency ? `${src.agency} · ` : ""}
                  {src?.cfr_citation ?? src?.title}
                </span>
              )}
              {src?.url && (
                <a
                  href={src.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-1 inline-flex items-center gap-0.5 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function GroupCard({
  icon,
  label,
  items,
  uploadedDocTypes,
}: {
  icon: React.ReactNode;
  label: string;
  items: DocumentChecklistItem[];
  uploadedDocTypes: string[];
}) {
  const isUploaded = (doc: DocumentChecklistItem) =>
    uploadedDocTypes.some((t) =>
      t.toLowerCase().includes(doc.document.toLowerCase().slice(0, 8)),
    );

  return (
    <Card className="overflow-hidden p-0">
      <p className="flex items-center gap-1.5 border-b px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </p>
      <div className="divide-y px-4">
        {items.map((doc) => (
          <DocRow key={doc.document} doc={doc} uploaded={isUploaded(doc)} />
        ))}
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
  const carrier = items.filter((d) => groupOf(d) === "carrier");
  const conditional = items.filter((d) => groupOf(d) === "conditional");

  const isUploaded = (doc: DocumentChecklistItem) =>
    uploadedDocTypes.some((t) =>
      t.toLowerCase().includes(doc.document.toLowerCase().slice(0, 8)),
    );

  const allActive = [...supplier, ...broker, ...carrier, ...conditional];
  const outstanding = allActive.filter((d) => !isUploaded(d) && deriveDocStatus(d) !== "not_required");

  const customsCount = outstanding.filter((d) => {
    const s = deriveDocStatus(d);
    return s === "required_to_clear" || s === "required_if";
  }).length;
  const beforeSaleCount = outstanding.filter((d) => deriveDocStatus(d) === "before_sale").length;
  const usuallyCount = outstanding.filter((d) => deriveDocStatus(d) === "usually_requested").length;

  const subcounts: string[] = [];
  if (customsCount > 0) subcounts.push(`${customsCount} ${t(lang, "doc_timing_customs")}`);
  if (beforeSaleCount > 0) subcounts.push(`${beforeSaleCount} ${t(lang, "doc_timing_before_sale")}`);
  if (usuallyCount > 0) subcounts.push(`${usuallyCount} ${t(lang, "doc_timing_usually_requested")}`);

  return (
    <div className="space-y-5">
      {outstanding.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{t(lang, "doc_outstanding_prefix")} <strong>{outstanding.length}</strong> {t(lang, "doc_outstanding_suffix")}</span>
          </div>
          {subcounts.length > 0 && (
            <p className="mt-1 pl-5 text-amber-700">{subcounts.join(" · ")}</p>
          )}
        </div>
      )}

      {/* A. Get from supplier */}
      {supplier.length > 0 && (
        <GroupCard
          icon={<Factory className="h-3.5 w-3.5" />}
          label={t(lang, "sec2_group_a")}
          items={supplier}
          uploadedDocTypes={uploadedDocTypes}
        />
      )}

      {/* B. Filed by importer / customs broker */}
      {broker.length > 0 && (
        <GroupCard
          icon={<FileCheck className="h-3.5 w-3.5" />}
          label={t(lang, "sec2_group_b")}
          items={broker}
          uploadedDocTypes={uploadedDocTypes}
        />
      )}

      {/* C. Provided by carrier */}
      {carrier.length > 0 && (
        <GroupCard
          icon={<Truck className="h-3.5 w-3.5" />}
          label={t(lang, "sec2_group_c")}
          items={carrier}
          uploadedDocTypes={uploadedDocTypes}
        />
      )}

      {/* Conditional */}
      {conditional.length > 0 && (
        <Card className="overflow-hidden p-0">
          <p className="flex items-center gap-1.5 border-b px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" /> {t(lang, "doc_group_conditional")}
          </p>
          <p className="border-b px-4 py-1.5 text-xs text-muted-foreground">
            {t(lang, "doc_group_conditional_help")}
          </p>
          <div className="divide-y px-4">
            {conditional.map((doc) => (
              <DocRow key={doc.document} doc={doc} uploaded={isUploaded(doc)} />
            ))}
          </div>
        </Card>
      )}

      {items.length === 0 && (
        <Card className="p-4 text-sm text-muted-foreground">{t(lang, "doc_none")}</Card>
      )}
    </div>
  );
}
