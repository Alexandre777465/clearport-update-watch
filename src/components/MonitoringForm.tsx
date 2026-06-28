/**
 * MonitoringFormBlock — self-contained form + risk scan confirmation.
 * Used on the homepage (index.tsx) and /onboarding.
 */

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  submitWatchlistEntry,
  pollScanResult,
  type WatchlistPreviewDoc,
  type ProductRiskScan,
  type ProductAttributes,
  type DocumentChecklistItem,
  type RiskCategory,
  API_URL,
} from "@/lib/api";
import { RiskScanCard } from "@/components/RiskScanCard";
import { LATEST_ENTRY_KEY } from "@/components/FloatingAssistant";
import { DocumentChecklist } from "@/components/DocumentChecklist";
import { BrokerPack } from "@/components/BrokerPack";
import { Link } from "@tanstack/react-router";
import { getLang, useLang, t, type DictKey, type Lang } from "@/lib/i18n";
import {
  CheckCircle2, Loader2, ExternalLink, ShieldCheck, ScanSearch, MessageSquare,
  AlertTriangle, DollarSign, ChevronDown, ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getQuestionsForProduct,
  answersToAttrs,
  type ProductQuestion,
} from "@/lib/productQuestions";

// No static clarification facts — questions are driven by detectModules().

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormState {
  email: string;
  productName: string;
  description: string;
  htsCode: string;
  originCountry: string;
  destination: string;
  estimatedValue: string;
  freightUsd: string;
  insuranceUsd: string;
  transportMode: "ocean" | "air" | "truck" | "rail" | "";
  manufacturerName: string;
  exporterName: string;
}

const DEFAULT_ATTRS: ProductAttributes = {
  is_children: false,
  has_battery: false,
  is_electronic: false,
  is_textile: false,
  is_cosmetic: false,
  is_food_contact: false,
  is_supplement: false,
  sold_on_amazon: false,
  sold_on_tiktok: false,
  sold_in_eu: false,
};

interface ConfirmedState {
  email: string;
  productName: string;
  description: string;
  htsCode: string;
  originCountry: string;
  destination: string;
  estimatedValue: string;
  freightUsd: string;
  insuranceUsd: string;
  transportMode: "ocean" | "air" | "truck" | "rail" | "";
  manufacturerName: string;
  exporterName: string;
  preview: WatchlistPreviewDoc[];
  riskScan: ProductRiskScan;
  isLocal: boolean;
  emailEnabled: boolean;
  entryId: string;
}

// ── Mock risk scan (client-side fallback when API not connected) ───────────────

function generateMockRiskScan(
  form: FormState,
  attrs: ProductAttributes,
): ProductRiskScan {
  const isChina = form.originCountry.toLowerCase().includes("china");
  const cats: ProductRiskScan["risk_categories"] = [];

  cats.push({
    category: "Tariff Risk",
    level: isChina ? "High" : "Medium",
    explanation: isChina
      ? "China-origin products face Section 301 tariffs between 7.5% and 25% depending on HTS code. Current rates are high and may change."
      : "Tariff exposure depends on your HTS code and origin country. Confirm current rates with your broker.",
    action: "Get a duty rate quote from your broker including all applicable tariffs before finalizing your landed cost.",
  });

  cats.push({
    category: "HTS Classification Risk",
    level: form.htsCode ? "Low" : "High",
    explanation: form.htsCode
      ? `You provided HTS code ${form.htsCode}. Verify this is correct with your broker — misclassification can result in penalties.`
      : "No HTS code provided. Without a confirmed HTS code, you cannot accurately estimate duties or check Section 301 exposure.",
    action: form.htsCode
      ? "Confirm your HTS code with a licensed customs broker before first import."
      : "Get your HTS code confirmed by a customs broker — this is your first step.",
  });

  if (isChina) {
    cats.push({
      category: "Section 301 China Tariff",
      level: "High",
      explanation:
        "China-origin goods may be subject to Section 301 tariffs (Lists 1–4A). Rates are 7.5%–25% depending on HTS code, plus standard MFN duties.",
      action:
        "Check your HTS code against the Section 301 tariff lists at USTR.gov. Ask your broker about any active exclusions.",
    });
  }

  cats.push({
    category: "AD/CVD Risk",
    level: "Medium",
    explanation:
      "Some product categories from China face antidumping (AD) or countervailing duty (CVD) orders on top of standard tariffs.",
    action:
      "Ask your broker to check CBP's ADCVD database for any orders that may cover your HTS code.",
  });

  if (attrs.has_battery) {
    cats.push({
      category: "Battery / UN 38.3",
      level: "High",
      explanation:
        "Battery-containing products require UN 38.3 test reports for air transport. Consumer electronics with batteries also need FCC/IC authorization.",
      action:
        "Request UN 38.3 test report from your supplier before booking air freight. Confirm FCC ID if the device transmits wirelessly.",
    });
  }

  if (attrs.is_children) {
    cats.push({
      category: "Children's Product / CPSIA",
      level: "Critical",
      explanation:
        "Products for children under 12 are regulated by CPSIA. You must have a Children's Product Certificate (CPC) backed by CPSC-accredited third-party testing before importing.",
      action:
        "This is non-negotiable. Request CPSIA test reports and CPC from your supplier now. Verify the testing lab is CPSC-accredited.",
    });
  }

  if (attrs.is_food_contact) {
    cats.push({
      category: "FDA Requirements",
      level: "High",
      explanation:
        "Food-contact materials must comply with FDA standards. The importer — not the supplier — is responsible for compliance.",
      action:
        "Request an FDA food-contact safety declaration from your supplier. Ask your broker if Prior Notice is required.",
    });
  }

  if (attrs.is_cosmetic) {
    cats.push({
      category: "FDA Requirements",
      level: "High",
      explanation:
        "Cosmetics and personal care products are regulated by FDA MoCRA. Labeling, ingredient listing, and prohibited substances rules apply.",
      action:
        "Get a Safety Data Sheet and full ingredient list from your supplier. Verify FDA labeling requirements for your product category.",
    });
  }

  if (attrs.is_supplement) {
    cats.push({
      category: "FDA Requirements",
      level: "Critical",
      explanation:
        "Dietary supplements and food products require FDA facility registration and may require Prior Notice before shipment enters the US.",
      action:
        "Confirm FDA facility registration with your supplier. Ask your broker about Prior Notice requirements before shipping.",
    });
  }

  if (attrs.is_electronic) {
    cats.push({
      category: "Product Safety / FCC",
      level: "Medium",
      explanation:
        "Electronic devices sold in the US require FCC authorization (either FCC ID or Supplier Declaration of Conformity).",
      action: "Request FCC authorization documentation from your supplier.",
    });
  }

  if (attrs.is_textile) {
    cats.push({
      category: "Textile / FTC Labeling",
      level: "Medium",
      explanation:
        "Textile products must bear country-of-origin labels, fiber content disclosure, and care instructions under FTC and CBP rules.",
      action: "Review labeling specifications with your supplier before production runs.",
    });
  }

  if (attrs.sold_on_amazon || attrs.sold_on_tiktok) {
    cats.push({
      category: "Marketplace Requirements",
      level: "Medium",
      explanation:
        "Amazon and TikTok Shop require product compliance documentation for many categories. Hazmat reviews, listing restrictions, and documentation uploads may block your listings.",
      action: `Check ${attrs.sold_on_amazon ? "Amazon Seller Central" : "TikTok Shop"} compliance requirements for your category before your first shipment.`,
    });
  }

  if (attrs.sold_in_eu) {
    cats.push({
      category: "EU Requirements",
      level: "Medium",
      explanation:
        "EU sales require CE marking for most product categories, GDPR compliance, and a local EU responsible person in most cases.",
      action:
        "Verify CE marking requirements for your product category. You will need an EU-based responsible person for product liability.",
    });
  }

  cats.push({
    category: "Customs Documentation",
    level: "Medium",
    explanation:
      "All imports require accurate commercial invoice, packing list, and CBP entry documentation. Errors cause delays and fines.",
    action:
      "Prepare your document package early. Work with your supplier on invoice details before production is complete.",
  });

  const hasCritical = cats.some((c) => c.level === "Critical");
  const hasHigh = cats.some((c) => c.level === "High");
  const overallRisk: ProductRiskScan["overall_risk"] = hasCritical
    ? "Critical"
    : hasHigh
    ? "High"
    : "Medium";

  let score = 40;
  if (form.htsCode) score += 15;
  if (form.description) score += 10;
  if (attrs.is_children) score -= 20;
  if (attrs.has_battery) score -= 10;
  if (attrs.is_supplement) score -= 20;
  if (attrs.is_food_contact) score -= 10;
  score = Math.max(10, Math.min(85, score));

  const docs: DocumentChecklistItem[] = [
    { document: "Commercial Invoice", required: true, responsibility: "supplier", reason: "Required for all imports — must show price, quantity, and party details." },
    { document: "Packing List", required: true, responsibility: "supplier", reason: "Must match the commercial invoice exactly." },
    { document: "Country-of-origin marking / declaration", required: true, responsibility: "importer_broker", reason: "Importer is responsible for legible country-of-origin marking (19 U.S.C. 1304)." },
    { document: "CBP Form 3461 & 7501 (entry / entry summary)", required: true, responsibility: "importer_broker", reason: "Filed by the importer of record or customs broker — not a supplier document." },
    { document: "Bill of Lading / Air Waybill", required: true, responsibility: "importer_broker", reason: "Transport document presented with the entry." },
  ];

  if (attrs.has_battery) {
    docs.push({ document: "UN 38.3 test summary", required: true, responsibility: "supplier", reason: "Required for lithium battery transport." });
    docs.push({ document: "Safety Data Sheet (SDS)", required: true, responsibility: "supplier", reason: "Required for lithium battery shipments." });
  }
  if (attrs.is_children) {
    docs.push({ document: "CPSC-accredited third-party test reports", required: true, responsibility: "supplier", reason: "Must be from a CPSC-accepted testing laboratory." });
    docs.push({ document: "Children's Product Certificate (CPC)", required: true, responsibility: "importer_broker", reason: "Issued by the U.S. importer based on the accredited test reports." });
  }
  if (attrs.is_food_contact) {
    docs.push({ document: "FDA food-contact compliance declaration", required: true, responsibility: "supplier", reason: "Confirms materials meet FDA food-contact standards (21 CFR 174–178)." });
  }
  if (attrs.is_cosmetic || attrs.is_supplement) {
    docs.push({ document: "Ingredient / safety documentation", required: false, responsibility: "conditional", reason: "Applicability depends on the product — confirm FDA obligations." });
  }
  if (attrs.is_electronic) {
    docs.push({ document: "FCC authorization / SDoC", required: false, responsibility: "conditional", reason: "Applicability depends on whether the device is an intentional/unintentional radiator." });
  }
  if (attrs.is_textile) {
    docs.push({ document: "Fiber content & care-labeling information (FTC 16 CFR 303)", required: true, responsibility: "supplier", reason: "Supplier provides fiber content and care-label data for FTC compliance." });
  }

  const brokerQuestions = [
    `What is the confirmed total duty rate for ${form.htsCode || "our HTS code"} including Section 301 tariffs?`,
    "Are there any active exclusions or tariff relief programs that apply?",
    "Are there any current AD/CVD orders that cover this product type?",
    "What documentation should accompany the customs entry?",
    "What is the expected processing time at port of entry?",
  ];
  if (attrs.is_children) brokerQuestions.push("What CPSIA documentation should accompany the shipment?");
  if (attrs.has_battery) brokerQuestions.push("What battery declaration is required for our shipping method?");

  const nextActions = [
    form.htsCode
      ? `Confirm HTS ${form.htsCode} is correct with a customs broker`
      : "Get your HTS code confirmed by a customs broker — this determines your duty rate",
    "Request required supplier documents before paying your production balance",
    "Get a landed cost estimate including all duties and fees",
    isChina ? "Verify Section 301 tariff exposure and check for exclusions" : "Confirm country-of-origin documentation requirements",
  ];
  if (attrs.is_children) nextActions.unshift("⚠️ Priority: Request CPSIA test reports and CPC from supplier immediately");
  if (attrs.has_battery) nextActions.unshift("⚠️ Priority: Request UN 38.3 test report before booking air freight");
  if (attrs.is_supplement) nextActions.unshift("⚠️ Priority: Confirm FDA registration and Prior Notice requirements with broker");

  return {
    id: `mock-${Date.now()}`,
    watchlist_entry_id: "",
    overall_risk: overallRisk,
    overall_summary: `${form.productName} has ${overallRisk.toLowerCase()} import risk${
      isChina ? " due to China-origin tariff exposure" : ""
    }${hasCritical ? " — immediate action required before importing" : "."}.`,
    risk_categories: cats,
    document_checklist: docs,
    broker_questions: brokerQuestions,
    supplier_questions: [
      "Can you provide a full product test report from an accredited third-party lab?",
      `What is the exact HS code used in your country for this product?`,
      "Can you provide a country-of-origin declaration signed by your factory?",
      attrs.has_battery
        ? "Can you provide the UN 38.3 test report for the battery?"
        : "What are the exact materials and components used in the product?",
    ],
    next_actions: nextActions,
    readiness_score: score,
    confidence_level: form.htsCode ? "Medium" : "Low",
    created_at: new Date().toISOString(),
  };
}

// Static attr questions removed — product attributes are inferred from
// dynamic module questions and the inferAttributes() keyword matcher.

// ── Attribute inference ───────────────────────────────────────────────────────
// Conservative keyword map: infers obvious product attributes from the name and
// description so we can flag likely-missed ones (e.g. a "water bottle" is almost
// certainly food-contact). Inference NEVER silently overrides the user — it only
// surfaces a confirmation step. Keep keywords tight to avoid false positives.

import { inferAttributes } from "@/lib/inferAttributes";

// Parse the optional shipment value into a positive number, or undefined.
function parseEstimatedValue(raw: string): number | undefined {
  const n = Number(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function MonitoringFormBlock({ headingAs = "h2" }: { headingAs?: "h1" | "h2" }) {
  const lang = useLang();
  const [form, setForm] = useState<FormState>({
    email: "",
    productName: "",
    description: "",
    htsCode: "",
    originCountry: "China",
    destination: "United States",
    estimatedValue: "",
    freightUsd: "",
    insuranceUsd: "",
    transportMode: "",
    manufacturerName: "",
    exporterName: "",
  });
  const [attrs, setAttrs] = useState<ProductAttributes>({ ...DEFAULT_ATTRS });
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [loadingStage, setLoadingStage] = useState<null | "saving" | "scanning">(null);
  const [confirmed, setConfirmed] = useState<ConfirmedState | null>(null);
  // Inferred attributes awaiting user confirmation before the scan runs.
  const [pendingInferred, setPendingInferred] = useState<
    Array<{ key: keyof ProductAttributes; labelKey: DictKey }> | null
  >(null);
  const [inferredAccept, setInferredAccept] = useState<Record<string, boolean>>({});
  // Dynamic question state
  const [showClarification, setShowClarification] = useState(false);
  const [knownFacts, setKnownFacts] = useState<Record<string, string>>({});
  // Async-scan failure state + the knownFacts to retry with.
  const [scanError, setScanError] = useState<string | null>(null);
  const [retryKnownFacts, setRetryKnownFacts] = useState<Record<string, string> | null>(null);

  // Detect which regulatory modules apply as the user types — drives question list.
  const dynamicQuestions = useMemo(
    () =>
      getQuestionsForProduct(
        form.htsCode.replace(/[^0-9]/g, ""),
        `${form.productName} ${form.description}`,
      ),
    [form.htsCode, form.productName, form.description],
  );

  const set =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  // toggleAttr kept for potential future use but not exposed in UI.

  const validate = (): boolean => {
    const errs: Partial<FormState> = {};
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = t(lang, "err_email");
    }
    if (!form.productName.trim()) {
      errs.productName = t(lang, "err_product");
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Runs the save (fast) then polls for the async scan result.
  const runScan = async (finalAttrs: ProductAttributes, facts: Record<string, string> = {}) => {
    setAttrs(finalAttrs);
    setRetryKnownFacts(facts);
    setPendingInferred(null);
    setShowClarification(false);
    setScanError(null);
    setLoadingStage("saving");

    try {
      const result = await submitWatchlistEntry({
        email: form.email.trim(),
        product_name: form.productName.trim(),
        product_description: form.description.trim() || undefined,
        hts_code: form.htsCode.trim() || undefined,
        origin_country: form.originCountry.trim() || "China",
        destination_country: form.destination.trim() || "United States",
        alert_frequency: "weekly",
        estimated_value_usd: parseEstimatedValue(form.estimatedValue),
        freight_usd: parseEstimatedValue(form.freightUsd),
        insurance_usd: parseEstimatedValue(form.insuranceUsd),
        transport_mode: form.transportMode || undefined,
        manufacturer_name: form.manufacturerName.trim() || undefined,
        exporter_name: form.exporterName.trim() || undefined,
        language: getLang(),
        known_facts: Object.keys(facts).length > 0 ? facts : undefined,
        ...finalAttrs,
      });

      let riskScan: ProductRiskScan;

      if (result.scan_status === "local") {
        // No backend — generate the mock scan client-side.
        riskScan = generateMockRiskScan(form, finalAttrs);
      } else {
        // Scan runs asynchronously on the backend; poll until ready.
        setLoadingStage("scanning");
        const polled = await pollScanResult(result.id);
        if (polled.status === "ready" && polled.scan) {
          riskScan = polled.scan;
        } else {
          setScanError(
            polled.status === "failed"
              ? t(lang, "err_scan_failed")
              : t(lang, "err_scan_timeout"),
          );
          setLoadingStage(null);
          return;
        }
      }

      // Persist the entryId so the FloatingAssistant stays bound after refresh.
      if (result.scan_status !== "local") {
        localStorage.setItem(LATEST_ENTRY_KEY, result.id);
        window.dispatchEvent(new CustomEvent("clearport:entry", { detail: result.id }));
      }

      setConfirmed({
        email: form.email.trim(),
        productName: form.productName.trim(),
        description: form.description.trim(),
        htsCode: form.htsCode.trim(),
        originCountry: form.originCountry.trim() || "China",
        destination: form.destination.trim() || "United States",
        estimatedValue: form.estimatedValue,
        freightUsd: form.freightUsd,
        insuranceUsd: form.insuranceUsd,
        transportMode: form.transportMode,
        manufacturerName: form.manufacturerName.trim(),
        exporterName: form.exporterName.trim(),
        preview: result.preview ?? [],
        riskScan,
        isLocal: result.scan_status === "local",
        emailEnabled: result.email_enabled,
        entryId: result.id,
      });
    } catch {
      setScanError(t(lang, "err_save"));
    } finally {
      setLoadingStage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Infer obvious attributes the user did not select.
    const missed = inferAttributes(form.productName, form.description).filter(
      (r) => !attrs[r.key],
    );
    if (missed.length > 0) {
      setPendingInferred(missed);
      setInferredAccept(Object.fromEntries(missed.map((m) => [m.key, true])));
      return;
    }

    // Show dynamic clarification questions if any modules are detected.
    if (dynamicQuestions.length > 0) {
      setKnownFacts({});
      setShowClarification(true);
      return;
    }

    await runScan(attrs);
  };

  if (loadingStage) {
    return <ScanningState stage={loadingStage} productName={form.productName} />;
  }

  if (confirmed) {
    return <ConfirmationView confirmed={confirmed} />;
  }

  if (scanError) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="p-6 text-center sm:p-8">
          <p className="font-semibold text-foreground">{t(lang, "scan_not_completed")}</p>
          <p className="mt-2 text-sm text-muted-foreground">{scanError}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button
              onClick={() => void runScan(attrs, retryKnownFacts ?? {})}
              disabled={!retryKnownFacts}
            >
              {t(lang, "btn_try_again")}
            </Button>
            <Button variant="outline" onClick={() => setScanError(null)}>
              {t(lang, "btn_back_edit")}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (showClarification) {
    const mergedAttrs = { ...attrs, ...answersToAttrs(knownFacts) };
    return (
      <div className="mx-auto max-w-xl">
        <DynamicClarificationStep
          questions={dynamicQuestions}
          answers={knownFacts}
          onChange={setKnownFacts}
          onContinue={() => void runScan(mergedAttrs, knownFacts)}
          onSkip={() => void runScan(attrs)}
        />
      </div>
    );
  }

  if (pendingInferred) {
    const proceed = () => {
      const merged = { ...attrs };
      for (const item of pendingInferred) {
        if (inferredAccept[item.key]) merged[item.key] = true;
      }
      setPendingInferred(null);
      setAttrs(merged);
      // If dynamic questions apply, show them; otherwise run the scan immediately.
      const qs = getQuestionsForProduct(
        form.htsCode.replace(/[^0-9]/g, ""),
        `${form.productName} ${form.description}`,
        merged,
      );
      if (qs.length > 0) {
        setKnownFacts({});
        setShowClarification(true);
        return;
      }
      void runScan(merged);
    };
    return (
      <div className="mx-auto max-w-xl">
        <Card className="p-6 sm:p-8">
          <div className="mb-4 flex items-start gap-3">
            <ScanSearch className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-semibold">{t(lang, "inf_title")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(lang, "inf_body")}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {pendingInferred.map((item) => {
              const checked = inferredAccept[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    setInferredAccept((s) => ({ ...s, [item.key]: !s[item.key] }))
                  }
                  className={`flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${
                    checked
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked ? "border-primary bg-primary text-white" : "border-slate-300"
                    }`}
                  >
                    {checked ? "✓" : ""}
                  </span>
                  {t(lang, item.labelKey)}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button onClick={proceed} size="lg" className="flex-1">
              <ScanSearch className="mr-2 h-4 w-4" />
              {t(lang, "inf_run")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setPendingInferred(null)}
            >
              {t(lang, "btn_back_edit")}
            </Button>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {t(lang, "inf_note")}
          </p>
        </Card>
      </div>
    );
  }

  const Heading = headingAs;

  return (
    <div>
      <div className="mb-6">
        <Heading className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t(lang, "form_title")}
        </Heading>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(lang, "form_intro")}
        </p>
      </div>

      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Email */}
          <div>
            <Label htmlFor="cp-email">
              {t(lang, "form_email")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cp-email"
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder={t(lang, "form_email_ph")}
              className="mt-1.5"
              autoComplete="email"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-destructive">{errors.email}</p>
            )}
          </div>

          {/* Product name */}
          <div>
            <Label htmlFor="cp-productName">
              {t(lang, "form_product")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cp-productName"
              value={form.productName}
              onChange={set("productName")}
              placeholder={t(lang, "form_product_ph")}
              className="mt-1.5"
            />
            {errors.productName && (
              <p className="mt-1 text-xs text-destructive">{errors.productName}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="cp-description">
              {t(lang, "form_desc")}{" "}
              <span className="text-xs text-muted-foreground">{t(lang, "form_desc_opt")}</span>
            </Label>
            <Textarea
              id="cp-description"
              value={form.description}
              onChange={set("description")}
              placeholder={t(lang, "form_desc_ph")}
              className="mt-1.5 resize-none"
              rows={2}
            />
          </div>

          {/* HTS code */}
          <div>
            <Label htmlFor="cp-htsCode">
              {t(lang, "form_hts")}{" "}
              <span className="text-xs text-muted-foreground">{t(lang, "form_hts_opt")}</span>
            </Label>
            <Input
              id="cp-htsCode"
              value={form.htsCode}
              onChange={set("htsCode")}
              placeholder={t(lang, "form_hts_ph")}
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t(lang, "form_hts_help")}
            </p>
          </div>

          {/* Estimated shipment value */}
          <div>
            <Label htmlFor="cp-value">
              {t(lang, "form_value")}{" "}
              <span className="text-xs text-muted-foreground">{t(lang, "form_value_opt")}</span>
            </Label>
            <Input
              id="cp-value"
              inputMode="decimal"
              value={form.estimatedValue}
              onChange={set("estimatedValue")}
              placeholder={t(lang, "form_value_ph")}
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t(lang, "form_value_help")}
            </p>
          </div>

          {/* Freight + insurance */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cp-freight">
                Freight (USD){" "}
                <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="cp-freight"
                inputMode="decimal"
                value={form.freightUsd}
                onChange={set("freightUsd")}
                placeholder="e.g. 2000"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="cp-insurance">
                Insurance (USD){" "}
                <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="cp-insurance"
                inputMode="decimal"
                value={form.insuranceUsd}
                onChange={set("insuranceUsd")}
                placeholder="e.g. 200"
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Transport mode */}
          <div>
            <Label>
              Shipping method{" "}
              <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(["ocean", "air", "truck", "rail"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      transportMode: f.transportMode === mode ? "" : mode,
                    }))
                  }
                  className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    form.transportMode === mode
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-foreground"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Used to determine Harbor Maintenance Fee (HMF applies to ocean only)
            </p>
          </div>

          {/* Manufacturer + exporter */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cp-manufacturer">
                Manufacturer{" "}
                <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="cp-manufacturer"
                value={form.manufacturerName}
                onChange={set("manufacturerName")}
                placeholder="Company name or Unknown"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="cp-exporter">
                Exporter{" "}
                <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="cp-exporter"
                value={form.exporterName}
                onChange={set("exporterName")}
                placeholder="Company name or Unknown"
                className="mt-1.5"
              />
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Required for exact AD/CVD rates — leave blank or enter Unknown if not yet known
          </p>

          {/* Route */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cp-origin">{t(lang, "form_origin")}</Label>
              <Input
                id="cp-origin"
                value={form.originCountry}
                onChange={set("originCountry")}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="cp-destination">{t(lang, "form_dest")}</Label>
              <Input
                id="cp-destination"
                value={form.destination}
                onChange={set("destination")}
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Detected regulatory modules hint */}
          {dynamicQuestions.length > 0 && (
            <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3">
              <p className="text-xs font-medium text-foreground">
                <ScanSearch className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
                ClearPort detected regulatory requirements — you'll answer a few specific questions on the next screen.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {Array.from(new Set(dynamicQuestions.map((q) => q.module)))
                  .map((m) => MODULE_LABELS[m])
                  .join(" · ")}
              </p>
            </div>
          )}

          <Button type="submit" size="lg" className="w-full">
            <ScanSearch className="mr-2 h-4 w-4" />
            {t(lang, "form_submit")}
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        <ShieldCheck className="mr-1 inline h-3 w-3" />
        {t(lang, "form_disclaimer")}
      </p>
    </div>
  );
}

// ── Scanning loading state ────────────────────────────────────────────────────

function ScanningState({
  stage,
  productName,
}: {
  stage: "saving" | "scanning";
  productName: string;
}) {
  const lang = useLang();
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
      <p className="mt-5 font-semibold text-foreground">
        {stage === "saving"
          ? t(lang, "scan_saving")
          : `${t(lang, "scan_scanning_for")} "${productName}"…`}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {stage === "saving"
          ? t(lang, "scan_saving_sub")
          : t(lang, "scan_scanning_sub")}
      </p>
    </div>
  );
}

// ── Import status helpers ─────────────────────────────────────────────────────

import {
  buildCostRows,
  collectMissingFacts,
  computeKnownTariffTotal,
  buildEnhancedCostRows,
  calculateMpf,
  type CostRowV2,
} from "@/lib/scanDisplay";


// ── Cost table row ────────────────────────────────────────────────────────────

function CostTableRow({ row, showAmount }: { row: CostRowV2; showAmount: boolean }) {
  const isNA = row.status === "not_applicable" || row.status === "no_applicable_rule";
  const isUnknown = row.status === "insufficient_info" || row.status === "source_unavailable";

  return (
    <tr className={isNA ? "opacity-45" : ""}>
      <td className="px-4 py-3 align-top">
        <span className={`text-sm ${isNA ? "text-muted-foreground" : "font-medium text-foreground"}`}>
          {row.label}
        </span>
        {row.calcBasis && !isNA && (
          <p className="mt-0.5 text-xs text-muted-foreground">{row.calcBasis}</p>
        )}
      </td>
      <td className="px-4 py-3 text-right align-top whitespace-nowrap">
        {row.rateText ? (
          <span className={`text-sm ${isNA ? "text-muted-foreground" : "font-medium"}`}>
            {row.rateText}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      {showAmount && (
        <td className="px-4 py-3 text-right align-top">
          {row.dollarText ? (
            <span className={`font-mono text-sm ${isNA ? "text-muted-foreground" : "font-medium"}`}>
              {row.dollarText}
            </span>
          ) : isUnknown && !isNA ? (
            <span className="text-xs text-amber-700 max-w-[160px] text-right leading-tight block">
              {row.answer}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
      )}
    </tr>
  );
}

// ── Regulatory category row (Section 3) ───────────────────────────────────────

function RegulatoryCategoryRow({ cat, lang }: { cat: RiskCategory; lang: Lang }) {
  const isVerified = cat.verification_status === "verified_applicable";
  const isUnconfirmed = cat.verification_status === "official_unconfirmed";

  const statusKey: DictKey = isVerified
    ? "law_status_required"
    : isUnconfirmed
      ? "law_status_cannot_determine"
      : "law_status_not_supported";

  const statusClass = isVerified
    ? "border-red-200 bg-red-50 text-red-700"
    : isUnconfirmed
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-slate-200 bg-slate-50 text-slate-500";

  const preSaleKeywords = ["fcc", "cpsia", "cpsc", "marketplace", "amazon", "tiktok", "eu ", "ftc", "labeling"];
  const isPreSale = preSaleKeywords.some((kw) => cat.category.toLowerCase().includes(kw));

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{cat.category}</span>
        <Badge variant="outline" className={`text-xs ${statusClass}`}>
          {t(lang, statusKey)}
        </Badge>
        {isPreSale && (
          <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 text-xs">
            {t(lang, "sec3_before_sale")}
          </Badge>
        )}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{cat.explanation}</p>
      {cat.applicability_conditions && (
        <p className="mt-1.5 text-xs">
          <span className="font-semibold text-foreground">{t(lang, "sec3_conditional")} </span>
          <span className="text-muted-foreground">{cat.applicability_conditions}</span>
        </p>
      )}
      {cat.action && (
        <p className="mt-1.5 text-xs text-muted-foreground">{cat.action}</p>
      )}
    </Card>
  );
}

// ── Confirmation + cockpit view ───────────────────────────────────────────────

function ConfirmationView({ confirmed }: { confirmed: ConfirmedState }) {
  const lang = useLang();
  const { riskScan } = confirmed;
  const [officialOpen, setOfficialOpen] = useState(false);
  const hasLivePreview = confirmed.preview.length > 0;

  const customsValueUsd = parseEstimatedValue(confirmed.estimatedValue);
  const transportMode = (confirmed.transportMode || null) as import("@/lib/scanDisplay").TransportMode;
  const enhancedRows = buildEnhancedCostRows(riskScan, lang, customsValueUsd, transportMode);
  const { knownPct, hasUnknown } = computeKnownTariffTotal(buildCostRows(riskScan, lang));
  const missingFacts = collectMissingFacts(riskScan).slice(0, 5);
  const nextSteps = riskScan.next_actions.slice(0, 3);

  // Known dollar total: tariff rows + MPF + HMF (when ocean)
  const knownTariffDollar = customsValueUsd != null ? (knownPct / 100) * customsValueUsd : null;
  const mpf = customsValueUsd != null ? calculateMpf(customsValueUsd) : null;
  const hmfAmount = transportMode === "ocean" && customsValueUsd != null
    ? (customsValueUsd * 0.125) / 100
    : null;
  const knownTotalDollar =
    knownTariffDollar != null && mpf != null
      ? knownTariffDollar + mpf.amount + (hmfAmount ?? 0)
      : null;
  const cannotTotalReason = hasUnknown
    ? "Exact AD/CVD rate requires manufacturer and exporter name"
    : !customsValueUsd
      ? "Customs value not provided"
      : null;

  // Section 3: non-tariff regulatory findings
  const tariffCatIds = new Set(["hts_duty", "hts_section301", "section_232_auto", "section_232"]);
  const tariffCatNames = new Set([
    "Tariff Risk", "HTS Classification Risk", "Section 301 China Tariff", "AD/CVD Risk",
  ]);
  const regulatoryCategories = riskScan.risk_categories.filter((c) => {
    if (c.level === "N/A") return false;
    if (c.id && (tariffCatIds.has(c.id) || c.id.startsWith("adcvd_"))) return false;
    if (tariffCatNames.has(c.category)) return false;
    return true;
  });

  // Section 4: margin impact items
  const marginItems = riskScan.risk_categories.filter((c) => c.financial_impact);

  return (
    <div className="space-y-8">
      {/* Status banner */}
      <Card className="border-green-200 bg-green-50/60 p-5">
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          <div>
            <p className="font-semibold text-green-900">
              {confirmed.isLocal ? t(lang, "conf_scan_generated") : t(lang, "conf_saved")}
            </p>
            <p className="mt-1 text-sm text-green-800">
              {confirmed.emailEnabled ? (
                lang === "zh" ? (
                  <>
                    {t(lang, "conf_email_pre")}
                    <strong>{confirmed.productName}</strong>
                    {t(lang, "conf_email_mid")}
                    <strong>{confirmed.email}</strong>。
                  </>
                ) : (
                  <>
                    {t(lang, "conf_email_pre")}{" "}
                    <strong>{confirmed.email}</strong> {t(lang, "conf_email_mid")}{" "}
                    <strong>{confirmed.productName}</strong>.
                  </>
                )
              ) : (
                <>
                  <strong>{confirmed.productName}</strong> {t(lang, "conf_email_disabled")}
                </>
              )}
            </p>
            {confirmed.isLocal && !API_URL && (
              <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
                {t(lang, "conf_backend_warn")}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Product / Route summary */}
      <Card className="divide-y overflow-hidden p-0">
        <div className="flex gap-3 px-4 py-3 text-sm">
          <span className="w-24 shrink-0 font-medium text-muted-foreground">{t(lang, "imp_product")}</span>
          <span className="text-foreground">{confirmed.productName}</span>
        </div>
        {(confirmed.originCountry || confirmed.destination) && (
          <div className="flex gap-3 px-4 py-3 text-sm">
            <span className="w-24 shrink-0 font-medium text-muted-foreground">{t(lang, "imp_route")}</span>
            <span className="text-foreground">
              {confirmed.originCountry || "—"} → {confirmed.destination || "—"}
            </span>
          </div>
        )}
        {confirmed.htsCode && (
          <div className="flex gap-3 px-4 py-3 text-sm">
            <span className="w-24 shrink-0 font-medium text-muted-foreground">{t(lang, "imp_hts_label")}</span>
            <span className="font-mono text-foreground">{confirmed.htsCode}</span>
          </div>
        )}
      </Card>

      {/* ── Section 1: What you will pay ─────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-xl font-semibold tracking-tight">{t(lang, "sec1_title")}</h2>
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50/80 text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">{t(lang, "sec1_charge")}</th>
                <th className="px-4 py-2 text-right font-medium">{t(lang, "sec1_rate")}</th>
                {customsValueUsd && (
                  <th className="px-4 py-2 text-right font-medium">{t(lang, "sec1_amount")}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {enhancedRows.map((row, i) => (
                <CostTableRow key={i} row={row} showAmount={customsValueUsd != null} />
              ))}
            </tbody>
          </table>
          {/* Known total / cannot-calculate notice */}
          {(knownTotalDollar != null || cannotTotalReason) && (
            <div className="border-t bg-slate-50/40 px-4 py-3">
              {knownTotalDollar != null && (
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold">{t(lang, "sec1_known_total")}</span>
                  <span className="font-mono text-sm font-semibold">
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(knownTotalDollar)}
                    {(hasUnknown) && <span className="ml-1 text-xs font-normal text-amber-700">+ AD/CVD</span>}
                  </span>
                </div>
              )}
              {cannotTotalReason && (
                <p className="mt-1 text-xs text-amber-700">
                  {t(lang, "sec1_cannot_total")}: {cannotTotalReason}
                </p>
              )}
            </div>
          )}
        </Card>
      </section>

      {/* ── Section 2: What you need to clear customs ─────────────────────── */}
      <section>
        <h2 className="mb-4 text-xl font-semibold tracking-tight">{t(lang, "sec2_title")}</h2>
        <DocumentChecklist items={riskScan.document_checklist} />
      </section>

      {/* ── Section 3: Laws and product requirements ──────────────────────── */}
      {regulatoryCategories.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold tracking-tight">{t(lang, "sec3_title")}</h2>
          <div className="space-y-2">
            {regulatoryCategories.map((cat, i) => (
              <RegulatoryCategoryRow key={cat.id ?? i} cat={cat} lang={lang} />
            ))}
          </div>
        </section>
      )}

      {/* ── Section 4: What could affect your margin ──────────────────────── */}
      {(marginItems.length > 0 || customsValueUsd != null) && (
        <section>
          <h2 className="mb-4 text-xl font-semibold tracking-tight">{t(lang, "sec4_title")}</h2>
          <Card className="p-4">
            <ul className="space-y-2.5">
              {customsValueUsd != null && (
                <li className="flex gap-2.5 text-sm">
                  <DollarSign className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                  <span>
                    <span className="font-medium">Known customs charges: </span>
                    {knownTotalDollar != null
                      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(knownTotalDollar) +
                        (hasUnknown ? " + AD/CVD (rate pending manufacturer/exporter)" : "")
                      : "Provide customs value to calculate"}
                  </span>
                </li>
              )}
              {marginItems.map((cat, i) => (
                <li key={cat.id ?? i} className="flex gap-2.5 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <span>
                    <span className="font-medium">{cat.category}: </span>
                    {cat.financial_impact}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {/* ── Information still missing ─────────────────────────────────────── */}
      {missingFacts.length > 0 && (
        <section>
          <h3 className="mb-3 font-semibold">{t(lang, "info_missing_title")}</h3>
          <Card className="p-4">
            <ul className="space-y-1.5">
              {missingFacts.map((fact, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  <span className="text-foreground">{fact}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {/* ── Next steps (max 3) ────────────────────────────────────────────── */}
      {nextSteps.length > 0 && (
        <section>
          <h3 className="mb-3 font-semibold">{t(lang, "next_steps_title")}</h3>
          <Card className="p-4">
            <ol className="space-y-2">
              {nextSteps.map((step, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-foreground">{step}</span>
                </li>
              ))}
            </ol>
          </Card>
        </section>
      )}

      {/* ── Official details and sources (collapsed by default) ───────────── */}
      <section>
        <button
          type="button"
          onClick={() => setOfficialOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm font-semibold hover:bg-muted/40 transition-colors"
        >
          <span className="flex items-center gap-2">
            <ScanSearch className="h-4 w-4 text-primary" />
            {t(lang, "official_details_title")}
          </span>
          {officialOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {officialOpen && (
          <div className="mt-4 space-y-8">
            {/* Detailed findings */}
            <div>
              <div className="mb-1 flex items-center gap-2">
                <h3 className="font-semibold">{t(lang, "imp_findings")}</h3>
              </div>
              <p className="mb-4 text-xs text-muted-foreground">{t(lang, "rep_baseline_sub")}</p>
              <RiskScanCard scan={riskScan} />
            </div>

            {/* Document checklist with sources */}
            <div>
              <h3 className="mb-4 font-semibold">{t(lang, "docs_section_title")}</h3>
              <DocumentChecklist items={riskScan.document_checklist} />
            </div>

            {/* Broker questions */}
            {riskScan.broker_questions.length > 0 && (
              <div>
                <h3 className="mb-3 font-semibold">{t(lang, "rep_broker_q")}</h3>
                <Card className="p-5">
                  <ul className="space-y-2">
                    {riskScan.broker_questions.map((q, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="text-muted-foreground">{i + 1}.</span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            )}

            {/* Broker pack */}
            <div>
              <h3 className="mb-4 font-semibold">{t(lang, "rep_broker_pack")}</h3>
              <BrokerPack
                productName={confirmed.productName}
                description={confirmed.description}
                htsCode={confirmed.htsCode}
                originCountry={confirmed.originCountry}
                destination={confirmed.destination}
                scan={riskScan}
              />
            </div>

            {/* Recent official updates */}
            <div>
              <h3 className="mb-2 font-semibold">{t(lang, "rep_changes")}</h3>
              {hasLivePreview ? (
                <>
                  <p className="mb-4 text-sm text-muted-foreground">{t(lang, "rep_changes_sub")}</p>
                  <div className="space-y-4">
                    {confirmed.preview.map((doc) => (
                      <LivePreviewCard key={doc.id} doc={doc} />
                    ))}
                  </div>
                </>
              ) : (
                <Card className="p-5 text-sm text-muted-foreground">{t(lang, "rep_no_change")}</Card>
              )}
            </div>

            {/* Ask ClearPort */}
            <Card className="flex flex-col items-start gap-3 border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold">{t(lang, "ask_q_title")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t(lang, "ask_q_body")}</p>
              </div>
              <Link to="/ask" search={{ entryId: confirmed.entryId }}>
                <Button className="shrink-0">
                  <MessageSquare className="mr-2 h-4 w-4" /> {t(lang, "ask_clearport")}
                </Button>
              </Link>
            </Card>
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        <ShieldCheck className="mr-1 inline h-3 w-3" />
        {t(lang, "disclaimer_long")}
      </p>
    </div>
  );
}

// ── Module display labels ─────────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  automotive: "Automotive / NHTSA",
  electronics: "Electronics / FCC",
  batteries: "Batteries / DOT-PHMSA",
  childrens: "Children's Products / CPSC",
  textiles: "Textiles / FTC",
  cosmetics: "Cosmetics / FDA",
  food: "Food / FDA-FSIS",
  medical_devices: "Medical Devices / FDA",
  chemicals: "Chemicals / EPA",
  furniture: "Furniture / EPA TSCA",
};

// ── Dynamic clarification step ────────────────────────────────────────────────

function DynamicClarificationStep({
  questions,
  answers,
  onChange,
  onContinue,
  onSkip,
}: {
  questions: ProductQuestion[];
  answers: Record<string, string>;
  onChange: (a: Record<string, string>) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const setAnswer = (key: string, value: string) =>
    onChange({ ...answers, [key]: value });

  // Visible questions: include all questions, but hide conditional ones if the
  // prerequisite answer is not set to one of the triggering values.
  const visibleQuestions = questions.filter((q) => {
    if (!q.showIf) return true;
    const parentAnswer = answers[q.showIf.key];
    return !!parentAnswer && q.showIf.values.includes(parentAnswer);
  });

  // Group visible questions by module for display.
  const moduleGroups: Record<string, ProductQuestion[]> = {};
  for (const q of visibleQuestions) {
    if (!moduleGroups[q.module]) moduleGroups[q.module] = [];
    moduleGroups[q.module].push(q);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Product details for compliance screening</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These questions let ClearPort determine exactly which regulations apply and what documentation you will need. Select "I don't know" to skip — ClearPort will state exactly what it cannot determine and why.
        </p>
      </div>

      {Object.entries(moduleGroups).map(([module, qs]) => (
        <div key={module}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {MODULE_LABELS[module] ?? module}
          </p>
          <Card className="divide-y overflow-hidden p-0">
            {qs.map((q) => (
              <div key={q.key} className="px-4 py-4 space-y-2">
                <p className="text-sm font-medium text-foreground">{q.question}</p>
                {q.helpText && (
                  <p className="text-xs text-muted-foreground">{q.helpText}</p>
                )}
                <RadioGroup
                  value={answers[q.key] ?? ""}
                  onValueChange={(v) => setAnswer(q.key, v)}
                  className="flex flex-col gap-1.5 pt-1"
                >
                  {q.options.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors ${
                        answers[q.key] === opt.value
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      } ${opt.value === "unknown" ? "opacity-70" : ""}`}
                    >
                      <RadioGroupItem value={opt.value} className="shrink-0" />
                      {opt.label}
                    </label>
                  ))}
                </RadioGroup>
              </div>
            ))}
          </Card>
        </div>
      ))}

      <div className="flex gap-3">
        <Button onClick={onContinue} className="flex-1">
          Run compliance scan →
        </Button>
        <Button variant="outline" onClick={onSkip} className="shrink-0">
          Skip
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        When "I don't know" is selected, ClearPort will state exactly what it cannot determine and why — it will never substitute vague language.
      </p>
    </div>
  );
}

// ── Alert preview cards ───────────────────────────────────────────────────────

function LivePreviewCard({ doc }: { doc: WatchlistPreviewDoc }) {
  const lang = useLang();
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{doc.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {doc.source_name}
            {doc.published_at ? ` · ${doc.published_at.slice(0, 10)}` : ""}
            {doc.effective_date ? ` · ${t(lang, "prev_effective")} ${doc.effective_date.slice(0, 10)}` : ""}
          </p>
        </div>
        {doc.source_url && (
          <a href={doc.source_url} target="_blank" rel="noreferrer" className="shrink-0 text-primary hover:underline">
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
      {doc.plain_english_summary && (
        <p className="mt-3 text-sm text-muted-foreground">{doc.plain_english_summary}</p>
      )}
      {doc.broker_questions?.length > 0 && (
        <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs">
          <p className="mb-1 font-medium text-foreground">{t(lang, "prev_what_ask")}</p>
          <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
            {doc.broker_questions.slice(0, 3).map((q) => <li key={q}>{q}</li>)}
          </ul>
        </div>
      )}
    </Card>
  );
}

