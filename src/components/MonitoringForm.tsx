/**
 * MonitoringFormBlock — self-contained form + risk scan confirmation.
 * Used on the homepage (index.tsx) and /onboarding.
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  submitWatchlistEntry,
  pollScanResult,
  type WatchlistPreviewDoc,
  type ProductRiskScan,
  type ProductAttributes,
  type DocumentChecklistItem,
  API_URL,
} from "@/lib/api";
import { RiskScanCard, riskColor } from "@/components/RiskScanCard";
import { DocumentChecklist } from "@/components/DocumentChecklist";
import { BrokerPack } from "@/components/BrokerPack";
import { ReadinessScore } from "@/components/ReadinessScore";
import { DocumentVault } from "@/components/DocumentVault";
import { HumanReviewCta } from "@/components/HumanReviewCta";
import {
  CheckCircle2, Loader2, ExternalLink, ShieldCheck, ScanSearch,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormState {
  email: string;
  productName: string;
  description: string;
  htsCode: string;
  originCountry: string;
  destination: string;
  estimatedValue: string;
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
  preview: WatchlistPreviewDoc[];
  riskScan: ProductRiskScan;
  isLocal: boolean;
  emailEnabled: boolean;
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
    { document: "Commercial Invoice", required: true, reason: "Required for all imports — must show price, quantity, and party details." },
    { document: "Packing List", required: true, reason: "Must match the commercial invoice exactly." },
    { document: "Country of Origin Declaration", required: true, reason: "Required to confirm origin for tariff calculation." },
    { document: "Product Photos", required: false, reason: "Strongly recommended — speeds up inspection if CBP queries the shipment." },
    { document: "Bill of Materials", required: false, reason: "Useful for classification and compliance documentation." },
  ];

  if (attrs.has_battery) {
    docs.push({ document: "UN 38.3 Test Report", required: true, reason: "Required for battery transport and CPSC compliance." });
    docs.push({ document: "SDS / MSDS", required: true, reason: "Required for lithium battery shipments." });
  }
  if (attrs.is_children) {
    docs.push({ document: "Children's Product Certificate (CPC)", required: true, reason: "Mandatory under CPSIA for products intended for children under 12." });
    docs.push({ document: "CPSC-accredited test reports", required: true, reason: "Must be from a CPSC-accredited testing laboratory." });
  }
  if (attrs.is_food_contact) {
    docs.push({ document: "Food Contact Safety Declaration", required: true, reason: "Required to confirm materials meet FDA food-contact standards." });
  }
  if (attrs.is_cosmetic || attrs.is_supplement) {
    docs.push({ document: "Safety Data Sheet (SDS)", required: true, reason: "Required for FDA-regulated products." });
    docs.push({ document: "Ingredient / Formula List", required: true, reason: "Required for FDA labeling compliance." });
  }
  if (attrs.is_electronic) {
    docs.push({ document: "FCC Authorization / SDoC", required: true, reason: "Required before sale of electronic devices in the US." });
  }
  if (attrs.is_textile) {
    docs.push({ document: "Fiber Content Certificate", required: true, reason: "Required for FTC textile labeling compliance." });
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

// ── Attribute toggle ──────────────────────────────────────────────────────────

const ATTR_QUESTIONS: Array<{ key: keyof ProductAttributes; label: string }> = [
  { key: "is_children",    label: "For children under 12" },
  { key: "has_battery",    label: "Contains a battery" },
  { key: "is_electronic",  label: "Electronic product" },
  { key: "is_textile",     label: "Textile / apparel" },
  { key: "is_cosmetic",    label: "Cosmetic / beauty / personal care" },
  { key: "is_food_contact",label: "Touches food or drink" },
  { key: "is_supplement",  label: "Supplement / food / medical-adjacent" },
  { key: "sold_on_amazon", label: "Selling on Amazon" },
  { key: "sold_on_tiktok", label: "Selling on TikTok Shop" },
  { key: "sold_in_eu",     label: "Also selling in the EU" },
];

// ── Attribute inference ───────────────────────────────────────────────────────
// Conservative keyword map: infers obvious product attributes from the name and
// description so we can flag likely-missed ones (e.g. a "water bottle" is almost
// certainly food-contact). Inference NEVER silently overrides the user — it only
// surfaces a confirmation step. Keep keywords tight to avoid false positives.

const INFERENCE_RULES: Array<{
  key: keyof ProductAttributes;
  label: string;
  keywords: string[];
}> = [
  { key: "is_food_contact", label: "Touches food or drink",
    keywords: ["water bottle", "bottle", "tumbler", "flask", "thermos", "mug", "cup",
      "drinkware", "drinking", "food", "plate", "bowl", "cutlery", "utensil",
      "straw", "lunchbox", "lunch box", "kettle", "sippy"] },
  { key: "is_children", label: "For children under 12",
    keywords: ["kids", "kid", "child", "children", "toddler", "baby", "infant",
      "nursery", "toy"] },
  { key: "has_battery", label: "Contains a battery",
    keywords: ["battery", "rechargeable", "li-ion", "lithium", "power bank", "cordless"] },
  { key: "is_electronic", label: "Electronic product",
    keywords: ["bluetooth", "wifi", "wi-fi", "usb", "charger", "speaker", "earbud",
      "headphone", "camera", "sensor", "electronic"] },
  { key: "is_textile", label: "Textile / apparel",
    keywords: ["shirt", "apparel", "clothing", "fabric", "textile", "cotton",
      "polyester", "garment", "sock", "hoodie", "jacket", "dress", "towel"] },
  { key: "is_cosmetic", label: "Cosmetic / beauty / personal care",
    keywords: ["cosmetic", "cream", "lotion", "serum", "makeup", "lipstick",
      "shampoo", "skincare", "beauty", "fragrance", "perfume"] },
  { key: "is_supplement", label: "Supplement / food / medical-adjacent",
    keywords: ["supplement", "vitamin", "protein", "probiotic", "capsule", "gummies"] },
];

function inferAttributes(
  name: string,
  description: string,
): Array<{ key: keyof ProductAttributes; label: string }> {
  const text = `${name} ${description}`.toLowerCase();
  return INFERENCE_RULES
    .filter((rule) => rule.keywords.some((kw) => text.includes(kw)))
    .map(({ key, label }) => ({ key, label }));
}

// Parse the optional shipment value into a positive number, or undefined.
function parseEstimatedValue(raw: string): number | undefined {
  const n = Number(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function MonitoringFormBlock({ headingAs = "h2" }: { headingAs?: "h1" | "h2" }) {
  const [form, setForm] = useState<FormState>({
    email: "",
    productName: "",
    description: "",
    htsCode: "",
    originCountry: "China",
    destination: "United States",
    estimatedValue: "",
  });
  const [attrs, setAttrs] = useState<ProductAttributes>({ ...DEFAULT_ATTRS });
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [loadingStage, setLoadingStage] = useState<null | "saving" | "scanning">(null);
  const [confirmed, setConfirmed] = useState<ConfirmedState | null>(null);
  // Inferred attributes awaiting user confirmation before the scan runs.
  const [pendingInferred, setPendingInferred] = useState<
    Array<{ key: keyof ProductAttributes; label: string }> | null
  >(null);
  const [inferredAccept, setInferredAccept] = useState<Record<string, boolean>>({});
  // Async-scan failure state + the attributes to retry with.
  const [scanError, setScanError] = useState<string | null>(null);
  const [retryAttrs, setRetryAttrs] = useState<ProductAttributes | null>(null);

  const set =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const toggleAttr = (key: keyof ProductAttributes) =>
    setAttrs((a) => ({ ...a, [key]: !a[key] }));

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

  // Runs the save (fast) then polls for the async scan result.
  const runScan = async (finalAttrs: ProductAttributes) => {
    setAttrs(finalAttrs);
    setRetryAttrs(finalAttrs);
    setPendingInferred(null);
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
              ? "We couldn't complete the risk scan. Your product was saved — please try again."
              : "The scan is taking longer than usual. Your product was saved — please try again.",
          );
          setLoadingStage(null);
          return;
        }
      }

      setConfirmed({
        email: form.email.trim(),
        productName: form.productName.trim(),
        description: form.description.trim(),
        htsCode: form.htsCode.trim(),
        originCountry: form.originCountry.trim() || "China",
        destination: form.destination.trim() || "United States",
        preview: result.preview ?? [],
        riskScan,
        isLocal: result.scan_status === "local",
        emailEnabled: result.email_enabled,
      });
    } catch {
      setScanError("Something went wrong saving your product. Please try again.");
    } finally {
      setLoadingStage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Infer obvious attributes the user did not select. If any conflict with an
    // unchecked box, pause and ask the user to confirm before scanning.
    const missed = inferAttributes(form.productName, form.description).filter(
      (r) => !attrs[r.key],
    );
    if (missed.length > 0) {
      setPendingInferred(missed);
      setInferredAccept(Object.fromEntries(missed.map((m) => [m.key, true])));
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
          <p className="font-semibold text-foreground">Scan not completed</p>
          <p className="mt-2 text-sm text-muted-foreground">{scanError}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button
              onClick={() => retryAttrs && void runScan(retryAttrs)}
              disabled={!retryAttrs}
            >
              Try again
            </Button>
            <Button variant="outline" onClick={() => setScanError(null)}>
              Back to edit
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (pendingInferred) {
    const proceed = () => {
      const merged = { ...attrs };
      for (const item of pendingInferred) {
        if (inferredAccept[item.key]) merged[item.key] = true;
      }
      void runScan(merged);
    };
    return (
      <div className="mx-auto max-w-xl">
        <Card className="p-6 sm:p-8">
          <div className="mb-4 flex items-start gap-3">
            <ScanSearch className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-semibold">Quick check before we scan</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Based on your product name and description, these characteristics
                look likely but weren't selected. Confirm the ones that apply —
                they change which compliance requirements we check.
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
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button onClick={proceed} size="lg" className="flex-1">
              <ScanSearch className="mr-2 h-4 w-4" />
              Run analysis
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setPendingInferred(null)}
            >
              Back to edit
            </Button>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            We never change your answers without asking. Uncheck anything that
            doesn't apply.
          </p>
        </Card>
      </div>
    );
  }

  const Heading = headingAs;
  const activeAttrs = Object.values(attrs).filter(Boolean).length;

  return (
    <div>
      <div className="mb-6">
        <Heading className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Start monitoring a product
        </Heading>
        <p className="mt-2 text-sm text-muted-foreground">
          We'll scan your product against official U.S. trade sources and check
          for relevant customs, tariff, and regulatory risks. We'll save it to
          your monitoring list so you can track it over time.
        </p>
      </div>

      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Email */}
          <div>
            <Label htmlFor="cp-email">
              Your email address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cp-email"
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
            <Label htmlFor="cp-productName">
              Product name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cp-productName"
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
            <Label htmlFor="cp-description">
              Product description{" "}
              <span className="text-xs text-muted-foreground">(optional — improves scan accuracy)</span>
            </Label>
            <Textarea
              id="cp-description"
              value={form.description}
              onChange={set("description")}
              placeholder="e.g. Portable rechargeable Bluetooth speaker, ABS plastic, 10W output"
              className="mt-1.5 resize-none"
              rows={2}
            />
          </div>

          {/* HTS code */}
          <div>
            <Label htmlFor="cp-htsCode">
              HTS / HS code{" "}
              <span className="text-xs text-muted-foreground">(optional — significantly improves scan)</span>
            </Label>
            <Input
              id="cp-htsCode"
              value={form.htsCode}
              onChange={set("htsCode")}
              placeholder="e.g. 8517.13.00"
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Find on past customs entries or ask your factory for their export HS code.
            </p>
          </div>

          {/* Estimated shipment value */}
          <div>
            <Label htmlFor="cp-value">
              Estimated customs value of shipment (USD){" "}
              <span className="text-xs text-muted-foreground">(optional — enables dollar impact)</span>
            </Label>
            <Input
              id="cp-value"
              inputMode="decimal"
              value={form.estimatedValue}
              onChange={set("estimatedValue")}
              placeholder="e.g. 25000"
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Used only to estimate dollar impact from verified official rates. Leave blank to see rates only.
            </p>
          </div>

          {/* Route */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cp-origin">Country of origin</Label>
              <Input
                id="cp-origin"
                value={form.originCountry}
                onChange={set("originCountry")}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="cp-destination">Import destination</Label>
              <Input
                id="cp-destination"
                value={form.destination}
                onChange={set("destination")}
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Product attribute questions */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <Label className="text-sm">
                Product details{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  — check everything that applies
                </span>
              </Label>
              {activeAttrs > 0 && (
                <Badge variant="outline" className="text-xs">
                  {activeAttrs} selected
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ATTR_QUESTIONS.map(({ key, label }) => {
                const checked = attrs[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleAttr(key)}
                    className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                      checked
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {checked ? "✓ " : ""}{label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              These answers determine which risk categories and compliance requirements we check.
            </p>
          </div>

          <Button type="submit" size="lg" className="w-full">
            <ScanSearch className="mr-2 h-4 w-4" />
            Start monitoring + generate risk scan
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        <ShieldCheck className="mr-1 inline h-3 w-3" />
        This is not legal or customs advice. Verify with your customs broker.
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
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
      <p className="mt-5 font-semibold text-foreground">
        {stage === "saving"
          ? "Saving your product…"
          : `Scanning import risks for "${productName}"…`}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {stage === "saving"
          ? "Setting up monitoring."
          : "Checking tariff exposure, compliance requirements, and documentation needs."}
      </p>
    </div>
  );
}

// ── Confirmation + cockpit view ───────────────────────────────────────────────

function ConfirmationView({ confirmed }: { confirmed: ConfirmedState }) {
  const { riskScan } = confirmed;
  const hasLivePreview = confirmed.preview.length > 0;

  return (
    <div className="space-y-8">
      {/* Confirmation banner */}
      <Card className="border-green-200 bg-green-50/60 p-5">
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          <div>
            <p className="font-semibold text-green-900">
              {confirmed.isLocal ? "Risk scan generated." : "Product saved for monitoring."}
            </p>
            <p className="mt-1 text-sm text-green-800">
              {confirmed.emailEnabled ? (
                <>
                  We'll monitor official U.S. trade sources and email{" "}
                  <strong>{confirmed.email}</strong> when a relevant update may affect{" "}
                  <strong>{confirmed.productName}</strong>.
                </>
              ) : (
                <>
                  <strong>{confirmed.productName}</strong> has been saved for
                  monitoring. Email alerts are not yet active — your risk scan is
                  ready below.
                </>
              )}
            </p>
            {confirmed.isLocal && !API_URL && (
              <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
                ⚠️ Backend not connected — entry not persisted. Set{" "}
                <code>VITE_API_URL</code> to connect the live backend.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Current verified baseline (standing requirements) */}
      <section>
        <div className="mb-1 flex items-center gap-2">
          <ScanSearch className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Current verified baseline</h3>
          <Badge variant="outline" className={`text-xs ${riskColor(riskScan.overall_risk)}`}>
            {riskScan.overall_risk} risk
          </Badge>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          What is true for this product right now, from official sources — duty
          rates and standing compliance requirements. Recent changes are shown
          separately below.
        </p>
        <RiskScanCard scan={riskScan} />
      </section>

      {/* Readiness score */}
      <section>
        <h3 className="mb-4 font-semibold">Launch readiness</h3>
        <ReadinessScore scan={riskScan} htsCode={confirmed.htsCode} />
      </section>

      {/* Document checklist */}
      <section>
        <h3 className="mb-4 font-semibold">Ask your supplier for these documents</h3>
        <DocumentChecklist items={riskScan.document_checklist} />
      </section>

      {/* Broker questions */}
      {riskScan.broker_questions.length > 0 && (
        <section>
          <h3 className="mb-3 font-semibold">Questions to ask your customs broker</h3>
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
        </section>
      )}

      {/* Broker pack */}
      <section>
        <h3 className="mb-4 font-semibold">Broker pack</h3>
        <BrokerPack
          productName={confirmed.productName}
          description={confirmed.description}
          htsCode={confirmed.htsCode}
          originCountry={confirmed.originCountry}
          destination={confirmed.destination}
          scan={riskScan}
        />
      </section>

      {/* Document vault */}
      <section>
        <h3 className="mb-4 font-semibold">Document vault</h3>
        <DocumentVault
          missingDocs={riskScan.document_checklist.filter((d) => d.required)}
        />
      </section>

      {/* Recent official updates — only real, HTS-relevant documents are shown.
          No example/mock government updates in production. */}
      <section>
        <h3 className="mb-2 font-semibold">Recent verified changes</h3>
        {hasLivePreview ? (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              Official publications from the last 30 days relevant to your HTS code —
              newly published rules, tariff actions, or notices, each linked to its source.
            </p>
            <div className="space-y-4">
              {confirmed.preview.map((doc) => (
                <LivePreviewCard key={doc.id} doc={doc} />
              ))}
            </div>
          </>
        ) : (
          <Card className="p-5 text-sm text-muted-foreground">
            No relevant change found in the last 30 days for this product.
            ClearPort will alert you here when a relevant official update is published.
          </Card>
        )}
      </section>

      {/* Human review upsell */}
      <section>
        <h3 className="mb-4 font-semibold">Want a human expert to review this?</h3>
        <HumanReviewCta productName={confirmed.productName} />
      </section>

      <p className="text-xs text-muted-foreground">
        <ShieldCheck className="mr-1 inline h-3 w-3" />
        This is not legal or customs advice. Verify all findings with your customs
        broker before making import decisions.
      </p>
    </div>
  );
}

// ── Alert preview cards ───────────────────────────────────────────────────────

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
          <p className="mb-1 font-medium text-foreground">What to ask your customs broker</p>
          <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
            {doc.broker_questions.slice(0, 3).map((q) => <li key={q}>{q}</li>)}
          </ul>
        </div>
      )}
    </Card>
  );
}

