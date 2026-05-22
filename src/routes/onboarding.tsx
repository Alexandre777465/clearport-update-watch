import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MarketingNav } from "@/components/MarketingNav";
import { submitWatchlistEntry, type WatchlistPreviewDoc, API_URL } from "@/lib/api";
import { alerts as mockAlerts } from "@/lib/mock";
import { CheckCircle2, Loader2, ExternalLink, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
  head: () => ({
    meta: [
      { title: "Start Monitoring — ClearPort" },
      {
        name: "description",
        content:
          "Enter your product details once. ClearPort monitors official U.S. trade sources and emails you when something relevant changes.",
      },
    ],
  }),
});

interface FormState {
  email: string;
  productName: string;
  description: string;
  htsCode: string;
  originCountry: string;
  destination: string;
}

interface ConfirmedState {
  email: string;
  productName: string;
  htsCode: string;
  originCountry: string;
  preview: WatchlistPreviewDoc[];
  isLocal: boolean;
}

function Onboarding() {
  const [form, setForm] = useState<FormState>({
    email: "",
    productName: "",
    description: "",
    htsCode: "",
    originCountry: "China",
    destination: "United States",
  });
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<ConfirmedState | null>(null);

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = (): boolean => {
    const errs: Partial<FormState> = {};
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = "A valid email address is required.";
    }
    if (!form.productName.trim()) {
      errs.productName = "Product name is required.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const result = await submitWatchlistEntry({
        email: form.email.trim(),
        product_name: form.productName.trim(),
        product_description: form.description.trim() || undefined,
        hts_code: form.htsCode.trim() || undefined,
        origin_country: form.originCountry.trim() || "China",
        destination_country: form.destination.trim() || "United States",
        alert_frequency: "weekly",
      });

      setConfirmed({
        email: form.email.trim(),
        productName: form.productName.trim(),
        htsCode: form.htsCode.trim(),
        originCountry: form.originCountry.trim() || "China",
        preview: result.preview ?? [],
        isLocal: result.id.startsWith("local-"),
      });
    } catch {
      setErrors({ email: "Something went wrong. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <MarketingNav />
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        {confirmed ? (
          <ConfirmationView confirmed={confirmed} />
        ) : (
          <MonitoringForm
            form={form}
            errors={errors}
            isSubmitting={isSubmitting}
            set={set}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </div>
  );
}

// ── Form ──────────────────────────────────────────────────────────────────────

function MonitoringForm({
  form,
  errors,
  isSubmitting,
  set,
  onSubmit,
}: {
  form: FormState;
  errors: Partial<FormState>;
  isSubmitting: boolean;
  set: (f: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Start monitoring a product
        </h1>
        <p className="mt-2 text-muted-foreground">
          Enter your product details once. ClearPort monitors official U.S. trade
          sources and emails you when something relevant changes.
        </p>
      </div>

      <Card className="p-6 sm:p-8">
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {/* Email */}
          <div>
            <Label htmlFor="email">
              Your email address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder="you@company.com"
              className="mt-1.5"
              autoComplete="email"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-destructive">{errors.email}</p>
            )}
          </div>

          {/* Product name */}
          <div>
            <Label htmlFor="productName">
              Product name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="productName"
              value={form.productName}
              onChange={set("productName")}
              placeholder="e.g. Bluetooth speaker"
              className="mt-1.5"
            />
            {errors.productName && (
              <p className="mt-1 text-xs text-destructive">{errors.productName}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">
              Product description{" "}
              <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={set("description")}
              placeholder="e.g. Portable rechargeable Bluetooth speaker, ABS plastic, 10W output"
              className="mt-1.5 resize-none"
              rows={3}
            />
          </div>

          {/* HTS code */}
          <div>
            <Label htmlFor="htsCode">
              HTS / HS code{" "}
              <span className="text-xs text-muted-foreground">(optional but improves matching)</span>
            </Label>
            <Input
              id="htsCode"
              value={form.htsCode}
              onChange={set("htsCode")}
              placeholder="e.g. 8517.13.00"
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Your 6–10 digit Harmonized Tariff code. Find it on past customs entries or ask your broker.
            </p>
          </div>

          {/* Route */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="originCountry">Country of origin</Label>
              <Input
                id="originCountry"
                value={form.originCountry}
                onChange={set("originCountry")}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="destination">Import destination</Label>
              <Input
                id="destination"
                value={form.destination}
                onChange={set("destination")}
                className="mt-1.5"
              />
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up monitoring…
              </>
            ) : (
              "Start monitoring"
            )}
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        <ShieldCheck className="mr-1 inline h-3 w-3" />
        This is not legal or customs advice. Verify with your customs broker.
      </p>
    </>
  );
}

// ── Confirmation + instant scan ───────────────────────────────────────────────

function ConfirmationView({ confirmed }: { confirmed: ConfirmedState }) {
  // If the backend returned preview docs, use them.
  // Otherwise show relevant mock alerts filtered by entered HTS code or origin country
  // and label them clearly as examples.
  const hasLivePreview = confirmed.preview.length > 0;

  const mockFallback = mockAlerts
    .filter(
      (a) =>
        (confirmed.htsCode && a.htsCodes.includes(confirmed.htsCode)) ||
        a.originCountries.some(
          (c) => c.toLowerCase() === confirmed.originCountry.toLowerCase(),
        ),
    )
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Confirmation banner */}
      <Card className="border-green-200 bg-green-50/60 p-6">
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          <div>
            <p className="font-semibold text-green-900">You're now monitoring this product.</p>
            <p className="mt-1 text-sm text-green-800">
              We'll monitor official U.S. trade sources and email{" "}
              <strong>{confirmed.email}</strong> when a relevant customs, tariff,
              or regulatory update may affect{" "}
              <strong>{confirmed.productName}</strong>.
            </p>
            {confirmed.isLocal && !API_URL && (
              <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                ⚠️ Backend not connected — your entry was not persisted. Configure{" "}
                <code>VITE_API_URL</code> and the Railway backend to enable real email alerts.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Instant scan */}
      <div>
        <h2 className="text-base font-semibold">
          {hasLivePreview
            ? "Recent updates that may be relevant to your product"
            : "Example updates from monitored sources"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasLivePreview
            ? "Found in the last 30 days from official U.S. trade sources."
            : "These are sample alerts showing the kind of updates ClearPort monitors."}
        </p>

        <div className="mt-4 space-y-4">
          {hasLivePreview
            ? confirmed.preview.map((doc) => (
                <LivePreviewCard key={doc.id} doc={doc} />
              ))
            : mockFallback.length > 0
              ? mockFallback.map((a) => (
                  <MockAlertCard key={a.id} alert={a} />
                ))
              : (
                <Card className="p-5 text-sm text-muted-foreground">
                  No recent updates found for this product in the last 30 days.
                  ClearPort will email you as soon as something relevant is published.
                </Card>
              )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        <ShieldCheck className="mr-1 inline h-3 w-3" />
        This is not legal or customs advice. Verify updates with your customs broker
        before making import decisions.
      </p>
    </div>
  );
}

function LivePreviewCard({ doc }: { doc: WatchlistPreviewDoc }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{doc.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {doc.source_name}
            {doc.published_at ? ` · ${doc.published_at.slice(0, 10)}` : ""}
            {doc.effective_date ? ` · Effective ${doc.effective_date.slice(0, 10)}` : ""}
          </p>
        </div>
        {doc.source_url && (
          <a
            href={doc.source_url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-primary hover:underline"
            aria-label="View official source"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      {doc.plain_english_summary && (
        <p className="mt-3 text-sm text-muted-foreground">{doc.plain_english_summary}</p>
      )}

      {doc.broker_questions?.length > 0 && (
        <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs">
          <p className="mb-1 font-medium text-foreground">What to ask your customs broker</p>
          <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
            {doc.broker_questions.slice(0, 3).map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function MockAlertCard({ alert }: { alert: (typeof mockAlerts)[0] }) {
  return (
    <Card className="p-5">
      <p className="font-semibold leading-snug">{alert.title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {alert.source} · {alert.publicationDate}
        {alert.effectiveDate !== "TBD" ? ` · Effective ${alert.effectiveDate}` : ""}
      </p>
      {alert.summary && (
        <p className="mt-3 text-sm text-muted-foreground">{alert.summary}</p>
      )}
      {alert.brokerQuestions?.length > 0 && (
        <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs">
          <p className="mb-1 font-medium text-foreground">What to ask your customs broker</p>
          <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
            {alert.brokerQuestions.slice(0, 3).map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
